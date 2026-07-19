/**
 * Firebase 읽기 전용 내보내기 (로컬 전용 이전 도구).
 *
 * ⚠️ 안전장치:
 *  - Firestore 는 **읽기 함수(getDoc/getDocs)만 import**. setDoc/addDoc/updateDoc/deleteDoc/writeBatch 는 import 조차 하지 않음.
 *  - Auth 는 signInWithPopup(Google)만. signInAnonymously/linkWithPopup/signInWithCredential 사용 안 함(익명 생성·연결·migrateCacheToUid 금지).
 *  - 앱의 기본 storage/Firebase(getFirebase)는 건드리지 않음 — 별도 named 앱('migrate-readonly')으로 격리 → Supabase 세션과 무관.
 *  - owner==현재 Google uid 인 프로젝트만 조회. sharedWith(공유받은) 프로젝트는 쿼리하지 않음.
 */
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
// READ-ONLY Firestore: 쓰기 함수는 의도적으로 import 하지 않음
import { getFirestore, collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '../../firebase/config';
import type { Project, FixtureDef, Asset } from '../../types';
import {
  BACKUP_SCHEMA_VERSION,
  type FirebaseBackup,
  type BackupProjectMeta,
  type BackupShare,
} from './backupTypes';
import { sha256Hex, canonicalPayload } from './validateBackup';

const APP_NAME = 'migrate-readonly';

function migrateApp(): FirebaseApp {
  return getApps().find((a) => a.name === APP_NAME) ?? initializeApp(firebaseConfig, APP_NAME);
}

/** 실제 사용자 클릭에서 호출 — 순수 Google 팝업 로그인(익명·연결·쓰기 없음) */
export async function signInFirebaseReadOnly(): Promise<{ uidTail: string; emailDomain: string | null }> {
  const auth = getAuth(migrateApp());
  const res = await signInWithPopup(auth, new GoogleAuthProvider());
  const u = res.user;
  return { uidTail: `…${u.uid.slice(-4)}`, emailDomain: u.email ? u.email.split('@')[1] ?? null : null };
}

export async function signOutFirebaseReadOnly(): Promise<void> {
  try {
    await signOut(getAuth(migrateApp()));
  } catch {
    /* ignore */
  }
}

function currentUser(): User {
  const u = getAuth(migrateApp()).currentUser;
  if (!u) throw new Error('Firebase 로그인이 필요합니다.');
  return u;
}

export interface FirestoreReadResult {
  projects: Project[]; // owner/sharedWith 제거된 Project
  fixtures: FixtureDef[];
  assets: Asset[];
  shares: BackupShare[];
  projectMeta: BackupProjectMeta[];
  ownerUidTail: string;
}

/** owner==현재 uid 인 projects + libraries/{uid} 읽기 전용 조회 후 정규화 */
export async function readFirestoreData(): Promise<FirestoreReadResult> {
  const u = currentUser();
  const uid = u.uid;
  const db = getFirestore(migrateApp());

  const snap = await getDocs(query(collection(db, 'projects'), where('owner', '==', uid)));

  const projects: Project[] = [];
  const shares: BackupShare[] = [];
  const projectMeta: BackupProjectMeta[] = [];

  for (const d of snap.docs) {
    const raw = d.data() as Record<string, unknown>;
    const stored = (raw.data ?? {}) as Project;
    const shareId = (raw.shareId ?? stored.shareId) as string | undefined;
    const shareEnabled = (raw.shareEnabled ?? stored.shareEnabled ?? false) as boolean;
    const sharePermission = (raw.sharePermission ?? stored.sharePermission ?? 'view') as string;

    // Project JSON 보존 + PII/식별자 제거(owner/sharedWith), 공유 식별자는 유지
    const project: Project = {
      ...stored,
      id: (stored.id ?? d.id) as string,
      shareId: shareId ?? undefined,
      shareEnabled,
      sharePermission: sharePermission as Project['sharePermission'],
    };
    delete (project as Partial<Project>).owner;
    delete (project as Partial<Project>).sharedWith;
    projects.push(project);

    if (shareId && shareEnabled) {
      shares.push({ projectId: project.id, shareId, shareEnabled, sharePermission });
    }

    const json = JSON.stringify(project);
    const glbIds = [...json.matchAll(/"localModelId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]);
    projectMeta.push({
      id: project.id,
      name: project.name,
      approxBytes: new TextEncoder().encode(json).length,
      layoutCount: Array.isArray(project.layouts) ? project.layouts.length : 0,
      hasCreatedAt: typeof project.createdAt === 'number',
      hasUpdatedAt: typeof project.updatedAt === 'number',
      hasDataUrl: /data:[a-z]+\//i.test(json),
      glbLocalModelIds: [...new Set(glbIds)],
      shareId,
      shareEnabled,
      sharePermission,
    });
  }

  const libSnap = await getDoc(doc(db, 'libraries', uid));
  const lib = libSnap.exists() ? (libSnap.data() as Record<string, unknown>) : null;
  const fixtures = (lib?.fixtures ?? []) as FixtureDef[];
  const assets = (lib?.assets ?? []) as Asset[];

  return { projects, fixtures, assets, shares, projectMeta, ownerUidTail: `…${uid.slice(-4)}` };
}

/** 읽은 데이터 → 버전 백업 JSON(체크섬 포함). timestamp 는 호출부(사용자 액션)에서 주입. */
export async function buildBackup(read: FirestoreReadResult, exportedAtIso: string): Promise<FirebaseBackup> {
  const base = {
    projects: read.projects,
    libraries: { fixtures: read.fixtures, assets: read.assets },
    shares: read.shares,
  };
  const checksum = await sha256Hex(canonicalPayload(base));
  const payloadBytes = new TextEncoder().encode(JSON.stringify(base)).length;

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAtIso,
    source: 'firebase',
    sourceProjectId: (firebaseConfig.projectId as string) ?? 'unknown',
    ownerRef: `fb-${read.ownerUidTail}`,
    projectCount: read.projects.length,
    ...base,
    projectMeta: read.projectMeta,
    integrity: { algo: 'sha256', checksum, totalBytes: payloadBytes },
  };
}

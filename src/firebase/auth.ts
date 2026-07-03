import {
  GoogleAuthProvider,
  linkWithPopup,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { Project, FixtureDef } from '../types';
import { getFirebase } from './app';

/**
 * 사용자 인증(익명 + Google) 헬퍼.
 *
 * - 익명 로그인은 app.ts(getFirebase) 에서 앱 실행 시 자동 수행.
 * - Google 로그인: 현재 익명 계정을 Google 로 **연결(link)** 해 uid 를 유지하고,
 *   이미 다른 기기에서 그 Google 계정을 쓴 적이 있으면(credential-already-in-use)
 *   기존 Google 계정으로 로그인한 뒤 이 기기의 로컬 프로젝트/집기를 그 uid 로 **이전**합니다.
 * - 결과적으로 같은 Google 계정은 어느 기기에서든 동일한 projects/libraries 를 봅니다.
 */

export interface AuthUser {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

/** 사용자가 팝업을 닫았거나 팝업이 막힌 경우 등 — 조용히 무시 */
function isPopupDismissed(code?: string): boolean {
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/popup-blocked' ||
    code === 'auth/user-cancelled'
  );
}

function toAuthUser(u: User): AuthUser {
  return {
    uid: u.uid,
    isAnonymous: u.isAnonymous,
    displayName: u.displayName,
    email: u.email,
    photoURL: u.photoURL,
  };
}

/** 인증 상태 구독. 정리 함수를 반환합니다. */
export function subscribeAuth(cb: (user: AuthUser | null) => void): () => void {
  let unsub = () => {};
  let cancelled = false;
  getFirebase()
    .then(({ auth }) => {
      if (cancelled) return;
      unsub = onAuthStateChanged(auth, (u) => cb(u ? toAuthUser(u) : null));
    })
    .catch(() => cb(null));
  return () => {
    cancelled = true;
    unsub();
  };
}

interface ProjectDoc {
  owner: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  currentLayoutId: string | null;
  data: Project;
}

function latestLayoutId(p: Project): string | null {
  if (!p.layouts?.length) return null;
  return p.layouts.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)).id;
}

function toProjectDoc(p: Project, owner: string): ProjectDoc {
  return {
    owner,
    name: p.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    currentLayoutId: latestLayoutId(p),
    data: p,
  };
}

/**
 * 이 기기의 로컬 캐시(현재 익명 사용자의 작업)를 targetUid 소유로 Firestore 에 업로드/병합.
 * (계정 전환 후 호출 — 이전 익명 uid 문서는 규칙상 읽지 못하므로 로컬 캐시를 기준으로 이전)
 */
async function migrateCacheToUid(targetUid: string): Promise<void> {
  const { db } = await getFirebase();
  let cacheProjects: Project[] = [];
  let cacheFixtures: FixtureDef[] = [];
  try {
    cacheProjects = JSON.parse(localStorage.getItem('blp:projects') || '[]');
    cacheFixtures = JSON.parse(localStorage.getItem('blp:fixtures') || '[]');
  } catch {
    /* ignore */
  }

  for (const p of cacheProjects) {
    await setDoc(doc(db, 'projects', p.id), toProjectDoc(p, targetUid));
  }

  if (cacheFixtures.length > 0) {
    const libRef = doc(db, 'libraries', targetUid);
    const libSnap = await getDoc(libRef);
    const existing = libSnap.exists() ? ((libSnap.data().fixtures ?? []) as FixtureDef[]) : [];
    const byId = new Map(existing.map((f) => [f.id, f]));
    for (const f of cacheFixtures) if (!byId.has(f.id)) byId.set(f.id, f);
    await setDoc(libRef, { fixtures: [...byId.values()], updatedAt: Date.now() });
  }
}

/** 다른 기기에서 이미 Google 계정을 링크했을 때, 그 계정의 프로젝트/집기가 있는지 확인용(없어도 무방) */
async function cloudHasOwner(uid: string): Promise<boolean> {
  const { db } = await getFirebase();
  const snap = await getDocs(query(collection(db, 'projects'), where('owner', '==', uid)));
  return !snap.empty;
}

/**
 * Google 로그인. 성공 시 페이지를 새로고침해 새 uid 기준으로 데이터를 다시 불러옵니다.
 * 사용자가 팝업을 닫으면 조용히 반환합니다.
 */
export async function signInWithGoogle(): Promise<void> {
  const { auth } = await getFirebase();
  const provider = new GoogleAuthProvider();
  const current = auth.currentUser;

  try {
    if (current && current.isAnonymous) {
      const anonUid = current.uid;
      try {
        // 익명 → Google 연결 (uid 유지, 기존 데이터 그대로 소유)
        await linkWithPopup(current, provider);
      } catch (err) {
        const code = (err as { code?: string })?.code;
        if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
          // 이미 다른 기기에서 링크된 Google 계정 → 그 계정으로 로그인 후 이 기기 데이터 이전
          const cred = GoogleAuthProvider.credentialFromError(err as never);
          if (!cred) throw err;
          const result = await signInWithCredential(auth, cred);
          const googleUid = result.user.uid;
          if (googleUid !== anonUid) {
            await cloudHasOwner(googleUid); // 워밍업(선택)
            await migrateCacheToUid(googleUid);
          }
        } else if (isPopupDismissed(code)) {
          return;
        } else {
          throw err;
        }
      }
    } else if (!current) {
      await signInWithPopup(auth, provider);
    } else {
      // 이미 Google(비익명)로 로그인됨
      return;
    }
  } catch (err) {
    if (isPopupDismissed((err as { code?: string })?.code)) return;
    throw err;
  }

  window.location.reload();
}

/** 로그아웃 후 다시 익명 로그인(앱은 계속 동작, 로컬 캐시 유지)하고 새로고침. */
export async function signOutUser(): Promise<void> {
  const { auth } = await getFirebase();
  await signOut(auth);
  await signInAnonymously(auth);
  window.location.reload();
}

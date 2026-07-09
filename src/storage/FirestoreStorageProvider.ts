import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import type { Project, FixtureDef, Layout, Asset, ProjectVisibility, SharePermission } from '../types';
import type { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { getFirebase } from '../firebase/app';
import { getProjectLastModified, getVisibility, normalizeEmails } from '../utils/project';

/**
 * FirestoreStorageProvider
 *
 * Firestore 를 기본 저장소로, LocalStorage 를 캐시/백업/오프라인 폴백으로 사용합니다.
 *  - 저장: LocalStorage 캐시 즉시 반영 → Firestore 저장(실패 시 예외로 상태 표시)
 *  - 불러오기: Firestore 최신본 → 캐시 갱신, 실패 시 캐시 반환(오프라인)
 *  - 최초 실행 시 LocalStorage 데이터를 Firestore 로 1회 마이그레이션(중복 방지)
 *
 * Firestore 구조
 *   projects/{projectId}  = { owner, sharedWith[], visibility, name, createdAt, updatedAt,
 *                             currentLayoutId, data: Project }
 *   libraries/{uid}       = { fixtures: FixtureDef[], updatedAt }   (전역 집기 라이브러리)
 *   users/{uid}           = { migrationCompleted: true }
 *
 * owner/sharedWith/visibility 는 쿼리·보안규칙을 위해 문서 최상위에 두고, data(Project) 안에도
 * 함께 저장합니다. (읽을 때는 최상위 값을 기준으로 Project 에 채워 넣습니다.)
 */

const MIGRATION_KEY = 'blp:cloudMigrated';

interface ProjectDoc {
  owner: string;
  sharedWith: string[];
  visibility: ProjectVisibility;
  shareId: string | null;
  shareEnabled: boolean;
  sharePermission: SharePermission;
  name: string;
  createdAt: number;
  updatedAt: number;
  currentLayoutId: string | null;
  data: Project;
}

function latestLayoutId(project: Project): string | null {
  if (!project.layouts || project.layouts.length === 0) return null;
  return project.layouts.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a)).id;
}

/** Project → Firestore 문서. owner 는 기존 소유자 유지(project.owner) 우선, 없으면 ownerFallback. */
function toProjectDoc(project: Project, ownerFallback: string): ProjectDoc {
  const owner = project.owner ?? ownerFallback;
  const sharedWith = normalizeEmails(project.sharedWith ?? []);
  const visibility: ProjectVisibility = project.visibility ?? (sharedWith.length ? 'shared' : 'private');
  const shareId = project.shareId ?? null;
  const shareEnabled = project.shareEnabled ?? false;
  const sharePermission: SharePermission = project.sharePermission ?? 'view';
  const data: Project = { ...project, owner, sharedWith, visibility, shareId: shareId ?? undefined, shareEnabled, sharePermission };
  return {
    owner,
    sharedWith,
    visibility,
    shareId,
    shareEnabled,
    sharePermission,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    currentLayoutId: latestLayoutId(project),
    data,
  };
}

/** Firestore 문서 → Project (최상위 owner/sharedWith/visibility/share* 를 채워 넣음, 하위 호환) */
function hydrateProject(raw: ProjectDoc): Project {
  const p = raw.data;
  return {
    ...p,
    owner: p.owner ?? raw.owner,
    sharedWith: p.sharedWith ?? raw.sharedWith ?? [],
    visibility: p.visibility ?? raw.visibility ?? getVisibility(p),
    shareId: p.shareId ?? raw.shareId ?? undefined,
    shareEnabled: p.shareEnabled ?? raw.shareEnabled ?? false,
    sharePermission: p.sharePermission ?? raw.sharePermission ?? 'view',
  };
}

export class FirestoreStorageProvider implements StorageProvider {
  private cache = new LocalStorageProvider();
  private migrated = false;

  /** 현재 로그인 사용자 기준(익명 또는 Google)의 db + uid + email */
  private async ctx(): Promise<{ db: import('firebase/firestore').Firestore; uid: string; email: string | null }> {
    const { db, auth, uid } = await getFirebase();
    return {
      db,
      uid: auth.currentUser?.uid ?? uid,
      email: auth.currentUser?.email?.toLowerCase() ?? null,
    };
  }

  // ---------- Project ----------
  async getProjects(): Promise<Project[]> {
    try {
      const { db, uid, email } = await this.ctx();
      await this.migrateIfNeeded();

      // 1) 내가 owner 인 프로젝트
      const byId = new Map<string, Project>();
      const ownerSnap = await getDocs(query(collection(db, 'projects'), where('owner', '==', uid)));
      for (const d of ownerSnap.docs) byId.set(d.id, hydrateProject(d.data() as ProjectDoc));

      // 2) 내 이메일이 sharedWith 에 포함된(공유받은) 프로젝트 (규칙 미설정 시 실패해도 무시)
      if (email) {
        try {
          const sharedSnap = await getDocs(
            query(collection(db, 'projects'), where('sharedWith', 'array-contains', email)),
          );
          for (const d of sharedSnap.docs) {
            if (!byId.has(d.id)) byId.set(d.id, hydrateProject(d.data() as ProjectDoc));
          }
        } catch {
          /* 공유 규칙 미적용 등 — 내 프로젝트는 정상 표시 */
        }
      }

      const projects = [...byId.values()];
      for (const p of projects) await this.cache.saveProject(p);
      return projects.sort((a, b) => getProjectLastModified(b) - getProjectLastModified(a));
    } catch {
      return this.cache.getProjects();
    }
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      const { db } = await getFirebase();
      await this.migrateIfNeeded();
      const d = await getDoc(doc(db, 'projects', id));
      if (d.exists()) {
        const p = hydrateProject(d.data() as ProjectDoc);
        await this.cache.saveProject(p);
        return p;
      }
      return this.cache.getProject(id);
    } catch {
      return this.cache.getProject(id);
    }
  }

  async saveProject(project: Project): Promise<void> {
    await this.cache.saveProject(project); // 즉시 캐시 (속도/오프라인)
    const { db, uid } = await this.ctx();
    await setDoc(doc(db, 'projects', project.id), toProjectDoc(project, uid));
    // 공유 링크 조회용 shares/{shareId} 문서 동기화 (인덱스 없이 getDoc 으로 해석 가능)
    if (project.shareId) {
      try {
        if (project.shareEnabled) {
          await setDoc(doc(db, 'shares', project.shareId), { projectId: project.id, updatedAt: Date.now() });
        } else {
          await deleteDoc(doc(db, 'shares', project.shareId));
        }
      } catch {
        /* 공유 링크 동기화 실패는 저장 자체를 막지 않음 */
      }
    }
  }

  async deleteProject(id: string): Promise<void> {
    await this.cache.deleteProject(id);
    const { db } = await getFirebase();
    await deleteDoc(doc(db, 'projects', id));
  }

  async getProjectByShareId(shareId: string): Promise<Project | null> {
    try {
      const { db } = await getFirebase();
      const shareSnap = await getDoc(doc(db, 'shares', shareId));
      if (!shareSnap.exists()) return this.cache.getProjectByShareId(shareId);
      const projectId = shareSnap.data().projectId as string;
      const pd = await getDoc(doc(db, 'projects', projectId));
      if (!pd.exists()) return null;
      const p = hydrateProject(pd.data() as ProjectDoc);
      if (!p.shareEnabled) return null; // 링크 비활성화됨
      await this.cache.saveProject(p);
      return p;
    } catch {
      return this.cache.getProjectByShareId(shareId);
    }
  }

  // ---------- Fixture 라이브러리 (uid 단위) ----------
  private async readCloudFixtures(): Promise<FixtureDef[]> {
    const { db, uid } = await this.ctx();
    const d = await getDoc(doc(db, 'libraries', uid));
    return d.exists() ? ((d.data().fixtures ?? []) as FixtureDef[]) : [];
  }

  private async writeCloudFixtures(fixtures: FixtureDef[]): Promise<void> {
    const { db, uid } = await this.ctx();
    // merge: 같은 문서의 assets(v0.9.7) 필드를 덮어쓰지 않도록 병합 저장
    await setDoc(doc(db, 'libraries', uid), { fixtures, updatedAt: Date.now() }, { merge: true });
  }

  async getFixtures(): Promise<FixtureDef[]> {
    try {
      const fixtures = await this.readCloudFixtures();
      // 캐시 전체 동기화 (삭제 반영 포함)
      localStorage.setItem('blp:fixtures', JSON.stringify(fixtures));
      return fixtures;
    } catch {
      return this.cache.getFixtures();
    }
  }

  async getFixture(id: string): Promise<FixtureDef | null> {
    const fixtures = await this.getFixtures();
    return fixtures.find((f) => f.id === id) ?? null;
  }

  async saveFixture(fixture: FixtureDef): Promise<void> {
    await this.cache.saveFixture(fixture);
    const cloud = await this.readCloudFixtures();
    const idx = cloud.findIndex((f) => f.id === fixture.id);
    if (idx >= 0) cloud[idx] = fixture;
    else cloud.push(fixture);
    await this.writeCloudFixtures(cloud);
  }

  // 전체 라이브러리를 한 번의 문서 쓰기로 저장 (v1.1.3) — 순서 변경 시 병렬 read-modify-write 경쟁 방지
  async saveFixtures(fixtures: FixtureDef[]): Promise<void> {
    await this.cache.saveFixtures(fixtures);
    await this.writeCloudFixtures(fixtures);
  }

  async deleteFixture(id: string): Promise<void> {
    await this.cache.deleteFixture(id);
    const cloud = await this.readCloudFixtures();
    await this.writeCloudFixtures(cloud.filter((f) => f.id !== id));
  }

  // ---------- Asset 라이브러리 (uid 단위, v0.9.7) ----------
  // 별도 컬렉션 대신 기존 libraries/{uid} 문서의 assets 필드에 저장합니다.
  // (이미 보안 규칙이 적용된 컬렉션을 재사용 → 규칙 추가 배포 없이 동작)
  //   libraries/{uid} = { fixtures: FixtureDef[], assets: Asset[], updatedAt }
  private async readCloudAssets(): Promise<Asset[]> {
    const { db, uid } = await this.ctx();
    const d = await getDoc(doc(db, 'libraries', uid));
    return d.exists() ? ((d.data().assets ?? []) as Asset[]) : [];
  }

  private async writeCloudAssets(assets: Asset[]): Promise<void> {
    const { db, uid } = await this.ctx();
    // merge: 같은 문서의 fixtures 필드를 덮어쓰지 않도록 병합 저장
    await setDoc(doc(db, 'libraries', uid), { assets, updatedAt: Date.now() }, { merge: true });
  }

  async getAssets(): Promise<Asset[]> {
    try {
      const assets = await this.readCloudAssets();
      localStorage.setItem('blp:assets', JSON.stringify(assets));
      return assets;
    } catch {
      return this.cache.getAssets();
    }
  }

  async saveAsset(asset: Asset): Promise<void> {
    await this.cache.saveAsset(asset);
    const cloud = await this.readCloudAssets();
    const idx = cloud.findIndex((a) => a.id === asset.id);
    if (idx >= 0) cloud[idx] = asset;
    else cloud.push(asset);
    await this.writeCloudAssets(cloud);
  }

  async deleteAsset(id: string): Promise<void> {
    await this.cache.deleteAsset(id);
    const cloud = await this.readCloudAssets();
    await this.writeCloudAssets(cloud.filter((a) => a.id !== id));
  }

  // ---------- Layout (프로젝트 문서에 임베드) ----------
  async getLayouts(projectId: string): Promise<Layout[]> {
    const project = await this.getProject(projectId);
    return project?.layouts ?? [];
  }

  async saveLayout(projectId: string, layout: Layout): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;
    const layouts = [...project.layouts];
    const idx = layouts.findIndex((l) => l.id === layout.id);
    if (idx >= 0) layouts[idx] = layout;
    else layouts.push(layout);
    await this.saveProject({ ...project, layouts });
  }

  async deleteLayout(projectId: string, layoutId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;
    await this.saveProject({
      ...project,
      layouts: project.layouts.filter((l) => l.id !== layoutId),
    });
  }

  // ---------- 마이그레이션 (LocalStorage → Firestore, 1회) ----------
  private async migrateIfNeeded(): Promise<void> {
    if (this.migrated || localStorage.getItem(MIGRATION_KEY) === 'true') {
      this.migrated = true;
      return;
    }
    const { db, uid } = await this.ctx();

    // 이미 마이그레이션한 계정인지 확인 (다른 기기 최초 실행 방지)
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists() && userSnap.data().migrationCompleted) {
      localStorage.setItem(MIGRATION_KEY, 'true');
      this.migrated = true;
      return;
    }

    // 로컬 프로젝트 업로드 (Firestore 에 없는 것만)
    const localProjects = await this.cache.getProjects();
    for (const p of localProjects) {
      const ref = doc(db, 'projects', p.id);
      const existing = await getDoc(ref);
      if (!existing.exists()) await setDoc(ref, toProjectDoc(p, uid));
    }

    // 로컬 집기 라이브러리 업로드 (클라우드가 비어 있을 때만)
    const localFixtures = await this.cache.getFixtures();
    const cloudFixtures = await this.readCloudFixtures();
    if (cloudFixtures.length === 0 && localFixtures.length > 0) {
      await this.writeCloudFixtures(localFixtures);
    }

    // 로컬 에셋 라이브러리 업로드 (클라우드가 비어 있을 때만, v0.9.7)
    try {
      const localAssets = await this.cache.getAssets();
      const cloudAssets = await this.readCloudAssets();
      if (cloudAssets.length === 0 && localAssets.length > 0) {
        await this.writeCloudAssets(localAssets);
      }
    } catch {
      /* 에셋 마이그레이션 실패는 전체 마이그레이션을 막지 않음 */
    }

    await setDoc(userRef, { migrationCompleted: true, migratedAt: Date.now() }, { merge: true });
    localStorage.setItem(MIGRATION_KEY, 'true');
    this.migrated = true;
  }
}

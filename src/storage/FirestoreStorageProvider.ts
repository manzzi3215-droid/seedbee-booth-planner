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
import type { Project, FixtureDef, Layout } from '../types';
import type { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { getFirebase } from '../firebase/app';
import { getProjectLastModified } from '../utils/project';

/**
 * FirestoreStorageProvider
 *
 * Firestore 를 기본 저장소로, LocalStorage 를 캐시/백업/오프라인 폴백으로 사용합니다.
 *  - 저장: LocalStorage 캐시 즉시 반영 → Firestore 저장(실패 시 예외로 상태 표시)
 *  - 불러오기: Firestore 최신본 → 캐시 갱신, 실패 시 캐시 반환(오프라인)
 *  - 최초 실행 시 LocalStorage 데이터를 Firestore 로 1회 마이그레이션(중복 방지)
 *
 * Firestore 구조
 *   projects/{projectId}  = { owner, name, createdAt, updatedAt, currentLayoutId, data: Project }
 *   libraries/{uid}       = { fixtures: FixtureDef[], updatedAt }   (전역 집기 라이브러리)
 *   users/{uid}           = { migrationCompleted: true }
 */

const MIGRATION_KEY = 'blp:cloudMigrated';

interface ProjectDoc {
  owner: string;
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

function toProjectDoc(project: Project, owner: string): ProjectDoc {
  return {
    owner,
    name: project.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    currentLayoutId: latestLayoutId(project),
    data: project,
  };
}

export class FirestoreStorageProvider implements StorageProvider {
  private cache = new LocalStorageProvider();
  private migrated = false;

  /** 현재 로그인 사용자 기준(익명 또는 Google)의 db + uid */
  private async ctx(): Promise<{ db: import('firebase/firestore').Firestore; uid: string }> {
    const { db, auth, uid } = await getFirebase();
    return { db, uid: auth.currentUser?.uid ?? uid };
  }

  // ---------- Project ----------
  async getProjects(): Promise<Project[]> {
    try {
      const { db, uid } = await this.ctx();
      await this.migrateIfNeeded();
      const snap = await getDocs(query(collection(db, 'projects'), where('owner', '==', uid)));
      const projects = snap.docs
        .map((d) => (d.data() as ProjectDoc).data)
        .filter((p): p is Project => Boolean(p));
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
        const p = (d.data() as ProjectDoc).data;
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
  }

  async deleteProject(id: string): Promise<void> {
    await this.cache.deleteProject(id);
    const { db } = await getFirebase();
    await deleteDoc(doc(db, 'projects', id));
  }

  // ---------- Fixture 라이브러리 (uid 단위) ----------
  private async readCloudFixtures(): Promise<FixtureDef[]> {
    const { db, uid } = await this.ctx();
    const d = await getDoc(doc(db, 'libraries', uid));
    return d.exists() ? ((d.data().fixtures ?? []) as FixtureDef[]) : [];
  }

  private async writeCloudFixtures(fixtures: FixtureDef[]): Promise<void> {
    const { db, uid } = await this.ctx();
    await setDoc(doc(db, 'libraries', uid), { fixtures, updatedAt: Date.now() });
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

  async deleteFixture(id: string): Promise<void> {
    await this.cache.deleteFixture(id);
    const cloud = await this.readCloudFixtures();
    await this.writeCloudFixtures(cloud.filter((f) => f.id !== id));
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

    await setDoc(userRef, { migrationCompleted: true, migratedAt: Date.now() }, { merge: true });
    localStorage.setItem(MIGRATION_KEY, 'true');
    this.migrated = true;
  }
}

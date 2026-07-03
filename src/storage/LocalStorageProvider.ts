import type { Project, FixtureDef, Layout } from '../types';
import type { StorageProvider } from './StorageProvider';
import { getProjectLastModified } from '../utils/project';

/**
 * LocalStorageProvider
 *
 * StorageProvider 를 브라우저 localStorage 로 구현한 버전입니다.
 * 나중에 FirestoreStorageProvider 를 만들어 storage/index.ts 에서
 * 이 클래스만 교체하면 앱 전체가 Firebase 로 넘어갑니다.
 */

const KEY_PREFIX = 'blp'; // booth-layout-planner
const PROJECTS_KEY = `${KEY_PREFIX}:projects`;
const FIXTURES_KEY = `${KEY_PREFIX}:fixtures`;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

/** 이전 버전 데이터(layouts 없음) 호환: layouts 를 항상 배열로 보정 */
function normalizeProject(project: Project): Project {
  return { ...project, layouts: project.layouts ?? [] };
}

/** 저장된 모든 프로젝트를 정규화하여 읽기 */
function readProjects(): Project[] {
  return readJSON<Project[]>(PROJECTS_KEY, []).map(normalizeProject);
}

export class LocalStorageProvider implements StorageProvider {
  async getProjects(): Promise<Project[]> {
    // 최근 수정 순(프로젝트/배치안 중 최신) 정렬
    return readProjects().sort(
      (a, b) => getProjectLastModified(b) - getProjectLastModified(a),
    );
  }

  async getProject(id: string): Promise<Project | null> {
    return readProjects().find((p) => p.id === id) ?? null;
  }

  async saveProject(project: Project): Promise<void> {
    const projects = readProjects();
    const normalized = normalizeProject(project);
    const idx = projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = normalized;
    } else {
      projects.push(normalized);
    }
    writeJSON(PROJECTS_KEY, projects);
  }

  async deleteProject(id: string): Promise<void> {
    const projects = readJSON<Project[]>(PROJECTS_KEY, []);
    writeJSON(
      PROJECTS_KEY,
      projects.filter((p) => p.id !== id),
    );
  }

  async getProjectByShareId(shareId: string): Promise<Project | null> {
    return readProjects().find((p) => p.shareId === shareId && p.shareEnabled) ?? null;
  }

  // --- Fixture ---
  // 집기는 등록 순서를 그대로 유지합니다(정렬하지 않음).
  async getFixtures(): Promise<FixtureDef[]> {
    return readJSON<FixtureDef[]>(FIXTURES_KEY, []);
  }

  async getFixture(id: string): Promise<FixtureDef | null> {
    const fixtures = readJSON<FixtureDef[]>(FIXTURES_KEY, []);
    return fixtures.find((f) => f.id === id) ?? null;
  }

  async saveFixture(fixture: FixtureDef): Promise<void> {
    const fixtures = readJSON<FixtureDef[]>(FIXTURES_KEY, []);
    const idx = fixtures.findIndex((f) => f.id === fixture.id);
    if (idx >= 0) {
      fixtures[idx] = fixture;
    } else {
      fixtures.push(fixture);
    }
    writeJSON(FIXTURES_KEY, fixtures);
  }

  async deleteFixture(id: string): Promise<void> {
    const fixtures = readJSON<FixtureDef[]>(FIXTURES_KEY, []);
    writeJSON(
      FIXTURES_KEY,
      fixtures.filter((f) => f.id !== id),
    );
  }

  // --- Layout ---
  // layouts 는 프로젝트 문서 안에 임베드되어 있습니다. 아래 메서드가 프로젝트를
  // 읽어 layouts 배열만 갱신하므로, UI 는 배열을 직접 만지지 않습니다.
  async getLayouts(projectId: string): Promise<Layout[]> {
    const project = await this.getProject(projectId);
    return project?.layouts ?? [];
  }

  async saveLayout(projectId: string, layout: Layout): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;
    const layouts = [...project.layouts];
    const idx = layouts.findIndex((l) => l.id === layout.id);
    if (idx >= 0) {
      layouts[idx] = layout;
    } else {
      layouts.push(layout);
    }
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
}

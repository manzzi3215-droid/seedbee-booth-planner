import type { Project, FixtureDef, Layout, Asset } from '../types';

/**
 * StorageProvider
 *
 * 앱의 모든 영속성(저장/불러오기)은 이 인터페이스를 통해서만 이뤄집니다.
 * UI/기능 코드는 구체적인 저장 방식(localStorage, Firebase 등)을 절대 알지 못합니다.
 *
 * ⚠️ 중요: 모든 메서드는 async 입니다.
 *   - 현재 구현(localStorage)은 동기지만 Promise 로 감쌉니다.
 *   - 이렇게 하면 나중에 Firebase Firestore(비동기)로 교체할 때
 *     호출부 코드를 전혀 수정하지 않아도 됩니다.
 */
export interface StorageProvider {
  // --- Project ---
  getProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  saveProject(project: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  /** 공유 링크 토큰으로 프로젝트 조회 (활성화된 링크만). 없으면 null (v0.8.3) */
  getProjectByShareId(shareId: string): Promise<Project | null>;

  // --- Fixture (집기 라이브러리) ---
  getFixtures(): Promise<FixtureDef[]>;
  getFixture(id: string): Promise<FixtureDef | null>;
  saveFixture(fixture: FixtureDef): Promise<void>;
  /**
   * 집기 라이브러리 전체를 한 번에 원자적으로 저장 (v1.1.3).
   * 순서 변경 등 여러 집기를 동시에 갱신할 때, 개별 saveFixture 를 병렬 호출하면
   * 같은 문서에 대한 read-modify-write 경쟁으로 일부만 반영되는 문제를 방지합니다.
   */
  saveFixtures(fixtures: FixtureDef[]): Promise<void>;
  deleteFixture(id: string): Promise<void>;

  // --- Asset (에셋 라이브러리, v0.9.7) ---
  getAssets(): Promise<Asset[]>;
  saveAsset(asset: Asset): Promise<void>;
  deleteAsset(id: string): Promise<void>;

  // --- Layout (프로젝트별 배치안 버전) ---
  // UI 는 layouts 배열을 직접 다루지 않고 아래 메서드만 사용합니다.
  // (Firebase 이전 시 projects/{id}/layouts 서브컬렉션으로 매핑되는 지점)
  getLayouts(projectId: string): Promise<Layout[]>;
  saveLayout(projectId: string, layout: Layout): Promise<void>;
  deleteLayout(projectId: string, layoutId: string): Promise<void>;
}

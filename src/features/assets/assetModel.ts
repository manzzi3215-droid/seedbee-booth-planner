import type {
  Asset,
  AssetCategory,
  AssetModelType,
  FixtureDef,
  FixtureShape,
} from '../../types';

/**
 * --- Asset Library 2.0 (v0.9.7) 모델 ---
 * 카테고리별 기본값(라벨/아이콘/기본 모델타입·형태·치수·색)과, 에셋 → 집기 정의 변환 헬퍼.
 * 배치는 기존 집기+디자인 매핑 파이프라인을 재사용하므로 2D/3D/조명/재질/Undo/저장이 자동 동작합니다.
 */

export interface CategoryMeta {
  key: AssetCategory;
  label: string; // 한국어 라벨
  icon: string; // 이모지 아이콘 (경량, 의존성 없음)
  modelType: AssetModelType;
  shape: FixtureShape;
  /** 기본 치수(mm) — 등록 폼 초기값 */
  widthMm: number;
  depthMm: number;
  heightMm: number;
  color: string;
}

export const ASSET_CATEGORIES: CategoryMeta[] = [
  { key: 'furniture', label: '가구', icon: '🪑', modelType: 'box', shape: 'rectangle', widthMm: 800, depthMm: 600, heightMm: 750, color: '#a3a3a3' },
  { key: 'displayFixture', label: '진열집기', icon: '🗄️', modelType: 'box', shape: 'rectangle', widthMm: 1000, depthMm: 500, heightMm: 1500, color: '#94a3b8' },
  { key: 'product', label: '제품', icon: '📦', modelType: 'box', shape: 'rectangle', widthMm: 120, depthMm: 120, heightMm: 200, color: '#f59e0b' },
  { key: 'pop', label: 'POP', icon: '🏷️', modelType: 'flat', shape: 'rectangle', widthMm: 300, depthMm: 20, heightMm: 400, color: '#ef4444' },
  { key: 'poster', label: '포스터', icon: '🖼️', modelType: 'flat', shape: 'rectangle', widthMm: 594, depthMm: 10, heightMm: 841, color: '#6366f1' },
  { key: 'banner', label: '배너', icon: '🚩', modelType: 'flat', shape: 'rectangle', widthMm: 600, depthMm: 10, heightMm: 1800, color: '#0ea5e9' },
  { key: 'decoration', label: '장식', icon: '✨', modelType: 'box', shape: 'roundedRectangle', widthMm: 300, depthMm: 300, heightMm: 300, color: '#d946ef' },
  { key: 'plant', label: '식물', icon: '🪴', modelType: 'cylinder', shape: 'circle', widthMm: 400, depthMm: 400, heightMm: 1200, color: '#22c55e' },
  { key: 'human', label: '사람', icon: '🧍', modelType: 'cylinder', shape: 'circle', widthMm: 450, depthMm: 300, heightMm: 1700, color: '#64748b' },
  { key: 'lighting', label: '조명', icon: '💡', modelType: 'cylinder', shape: 'circle', widthMm: 200, depthMm: 200, heightMm: 150, color: '#fde047' },
  { key: 'wallObject', label: '벽부착물', icon: '🧱', modelType: 'flat', shape: 'rectangle', widthMm: 500, depthMm: 30, heightMm: 500, color: '#f97316' },
  { key: 'floorObject', label: '바닥오브젝트', icon: '⬛', modelType: 'box', shape: 'rectangle', widthMm: 600, depthMm: 600, heightMm: 100, color: '#78716c' },
  { key: 'signage', label: '사이니지', icon: '🪧', modelType: 'flat', shape: 'rectangle', widthMm: 800, depthMm: 40, heightMm: 300, color: '#14b8a6' },
  { key: 'custom', label: '커스텀', icon: '🧩', modelType: 'box', shape: 'rectangle', widthMm: 500, depthMm: 500, heightMm: 500, color: '#cbd5e1' },
];

const CATEGORY_MAP = new Map(ASSET_CATEGORIES.map((c) => [c.key, c]));

export function categoryMeta(key: AssetCategory): CategoryMeta {
  return CATEGORY_MAP.get(key) ?? CATEGORY_MAP.get('custom')!;
}

export function categoryLabel(key: AssetCategory): string {
  return categoryMeta(key).label;
}

/** 모델타입 → 집기 형태 */
export function shapeForModelType(modelType: AssetModelType | undefined, fallback: FixtureShape): FixtureShape {
  if (modelType === 'cylinder') return 'circle';
  if (modelType === 'flat' || modelType === 'box') return 'rectangle';
  return fallback;
}

/** 에셋 → 배치용 집기 정의(FixtureDef) 변환. defId 는 호출부에서 생성해 전달. */
export function fixtureDefFromAsset(asset: Asset, defId: string): FixtureDef {
  const meta = categoryMeta(asset.category);
  return {
    id: defId,
    name: asset.name,
    shape: shapeForModelType(asset.modelType, meta.shape),
    widthMm: asset.widthMm,
    depthMm: asset.depthMm,
    heightMm: asset.heightMm ?? meta.heightMm,
    color: asset.color ?? meta.color,
    material: asset.material,
    memo: `에셋: ${categoryLabel(asset.category)}${asset.brand ? ` · ${asset.brand}` : ''}`,
  };
}

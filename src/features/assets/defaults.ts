import type { Asset } from '../../types';

/**
 * 기본 샘플 에셋 (v0.9.7) — 구조 검증용으로 소수만 제공합니다.
 * 이미지 없이 색/치수/카테고리만 있는 데이터 에셋입니다(썸네일은 카테고리 아이콘으로 대체 표시).
 * id/createdAt/updatedAt 은 시드 시 채웁니다.
 */
export type DefaultAsset = Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>;

const co = (a: Omit<DefaultAsset, 'visibility' | 'version'>): DefaultAsset => ({
  visibility: 'company',
  version: 1,
  ...a,
});

export const DEFAULT_ASSETS: DefaultAsset[] = [
  // --- 기본 8종 (v0.9.7) ---
  co({ name: '기본 카운터', category: 'furniture', widthMm: 1000, depthMm: 500, heightMm: 1000, modelType: 'box', color: '#9ca3af', tags: ['카운터', '데스크'] }),
  co({ name: '진열대', category: 'displayFixture', widthMm: 1200, depthMm: 450, heightMm: 1600, modelType: 'box', color: '#94a3b8', tags: ['선반', '진열'] }),
  co({ name: '원형 테이블', category: 'furniture', widthMm: 800, depthMm: 800, heightMm: 720, modelType: 'cylinder', color: '#a8a29e', tags: ['테이블', '원형'] }),
  co({ name: 'POP 스탠드', category: 'pop', widthMm: 350, depthMm: 350, heightMm: 1400, modelType: 'flat', color: '#ef4444', tags: ['POP', '스탠드'] }),
  co({ name: '배너', category: 'banner', widthMm: 600, depthMm: 10, heightMm: 2000, modelType: 'flat', color: '#0ea5e9', tags: ['배너', '현수막'] }),
  co({ name: '화분', category: 'plant', widthMm: 400, depthMm: 400, heightMm: 1200, modelType: 'cylinder', color: '#22c55e', tags: ['식물', '조경'] }),
  co({ name: '성인 사람 실루엣', category: 'human', widthMm: 450, depthMm: 300, heightMm: 1700, modelType: 'cylinder', color: '#64748b', tags: ['사람', '스케일'] }),
  co({ name: '스포트라이트', category: 'lighting', widthMm: 200, depthMm: 200, heightMm: 150, modelType: 'cylinder', color: '#fde047', tags: ['조명', '스팟'] }),

  // --- Furniture Asset Library 확장 (v0.9.8) ---
  co({ name: 'Chair', category: 'furniture', widthMm: 450, depthMm: 480, heightMm: 850, modelType: 'box', color: '#a3a3a3', tags: ['의자', 'chair'] }),
  co({ name: 'Round Chair', category: 'furniture', widthMm: 480, depthMm: 480, heightMm: 800, modelType: 'cylinder', color: '#a8a29e', tags: ['의자', 'round'] }),
  co({ name: 'Table', category: 'furniture', widthMm: 1200, depthMm: 600, heightMm: 720, modelType: 'box', color: '#c9a36a', tags: ['테이블', 'table'] }),
  co({ name: 'Round Table', category: 'furniture', widthMm: 900, depthMm: 900, heightMm: 720, modelType: 'cylinder', color: '#c9a36a', tags: ['테이블', 'round'] }),
  co({ name: 'Side Table', category: 'furniture', widthMm: 450, depthMm: 450, heightMm: 550, modelType: 'box', color: '#b8bcc0', tags: ['사이드', 'table'] }),
  co({ name: 'Sofa', category: 'furniture', widthMm: 1800, depthMm: 850, heightMm: 800, modelType: 'box', color: '#8a95a5', tags: ['소파', 'sofa'] }),
  co({ name: 'Bench', category: 'furniture', widthMm: 1200, depthMm: 400, heightMm: 450, modelType: 'box', color: '#9aa0a6', tags: ['벤치', 'bench'] }),
  co({ name: 'Shelf', category: 'displayFixture', widthMm: 900, depthMm: 350, heightMm: 1800, modelType: 'box', color: '#94a3b8', tags: ['선반', 'shelf'] }),
  co({ name: 'Rack', category: 'displayFixture', widthMm: 1000, depthMm: 500, heightMm: 1500, modelType: 'box', color: '#94a3b8', tags: ['랙', 'rack'] }),
  co({ name: 'Counter Decoration', category: 'decoration', widthMm: 600, depthMm: 300, heightMm: 250, modelType: 'box', color: '#d946ef', tags: ['카운터', '장식'] }),

  // --- Decoration Layer 에셋 (v0.9.8) ---
  co({ name: 'Plant', category: 'plant', widthMm: 350, depthMm: 350, heightMm: 700, modelType: 'cylinder', color: '#22c55e', tags: ['식물', 'plant'] }),
  co({ name: 'Tall Plant', category: 'plant', widthMm: 450, depthMm: 450, heightMm: 1800, modelType: 'cylinder', color: '#16a34a', tags: ['식물', 'tall'] }),
  co({ name: 'Lamp', category: 'lighting', widthMm: 300, depthMm: 300, heightMm: 500, modelType: 'cylinder', color: '#fde047', tags: ['램프', 'lamp'] }),
  co({ name: 'Floor Lamp', category: 'lighting', widthMm: 350, depthMm: 350, heightMm: 1600, modelType: 'cylinder', color: '#fcd34d', tags: ['조명', 'floor'] }),
  co({ name: 'Mirror', category: 'decoration', widthMm: 600, depthMm: 40, heightMm: 1600, modelType: 'flat', color: '#e6f0f4', tags: ['거울', 'mirror'] }),
  co({ name: 'TV', category: 'decoration', widthMm: 1200, depthMm: 80, heightMm: 700, modelType: 'flat', color: '#1f2937', tags: ['TV', '모니터'] }),
  co({ name: 'Monitor', category: 'decoration', widthMm: 620, depthMm: 60, heightMm: 400, modelType: 'flat', color: '#111827', tags: ['모니터', 'monitor'] }),
  co({ name: 'Laptop', category: 'decoration', widthMm: 340, depthMm: 240, heightMm: 20, modelType: 'flat', color: '#374151', tags: ['노트북', 'laptop'] }),
  co({ name: 'Tablet', category: 'decoration', widthMm: 250, depthMm: 180, heightMm: 12, modelType: 'flat', color: '#111827', tags: ['태블릿', 'tablet'] }),
  co({ name: 'Leaflet', category: 'pop', widthMm: 210, depthMm: 100, heightMm: 5, modelType: 'flat', color: '#f3f4f6', tags: ['리플렛', '브로슈어'] }),
  co({ name: 'Vase', category: 'decoration', widthMm: 250, depthMm: 250, heightMm: 400, modelType: 'cylinder', color: '#d946ef', tags: ['화병', 'vase'] }),
  co({ name: 'Trash Bin', category: 'floorObject', widthMm: 300, depthMm: 300, heightMm: 600, modelType: 'cylinder', color: '#78716c', tags: ['휴지통', 'bin'] }),
  co({ name: 'Curtain', category: 'decoration', widthMm: 2000, depthMm: 100, heightMm: 2400, modelType: 'flat', color: '#dfe3ea', tags: ['커튼', 'curtain'] }),
  co({ name: 'Frame', category: 'wallObject', widthMm: 700, depthMm: 30, heightMm: 900, modelType: 'flat', color: '#f59e0b', tags: ['액자', 'frame'] }),
  co({ name: 'Sign', category: 'signage', widthMm: 800, depthMm: 40, heightMm: 300, modelType: 'flat', color: '#14b8a6', tags: ['사인', 'sign'] }),
  co({ name: 'Poster Stand', category: 'pop', widthMm: 600, depthMm: 400, heightMm: 1600, modelType: 'flat', color: '#6366f1', tags: ['포스터', '스탠드'] }),
  co({ name: 'Roll Banner', category: 'banner', widthMm: 850, depthMm: 300, heightMm: 2000, modelType: 'flat', color: '#0ea5e9', tags: ['롤배너', 'roll'] }),
];

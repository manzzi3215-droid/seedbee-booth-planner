import type { Asset } from '../../types';

/**
 * 기본 샘플 에셋 (v0.9.7) — 구조 검증용으로 소수만 제공합니다.
 * 이미지 없이 색/치수/카테고리만 있는 데이터 에셋입니다(썸네일은 카테고리 아이콘으로 대체 표시).
 * id/createdAt/updatedAt 은 시드 시 채웁니다.
 */
export type DefaultAsset = Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>;

export const DEFAULT_ASSETS: DefaultAsset[] = [
  { name: '기본 카운터', category: 'furniture', widthMm: 1000, depthMm: 500, heightMm: 1000, modelType: 'box', color: '#9ca3af', visibility: 'company', tags: ['카운터', '데스크'], version: 1 },
  { name: '진열대', category: 'displayFixture', widthMm: 1200, depthMm: 450, heightMm: 1600, modelType: 'box', color: '#94a3b8', visibility: 'company', tags: ['선반', '진열'], version: 1 },
  { name: '원형 테이블', category: 'furniture', widthMm: 800, depthMm: 800, heightMm: 720, modelType: 'cylinder', color: '#a8a29e', visibility: 'company', tags: ['테이블', '원형'], version: 1 },
  { name: 'POP 스탠드', category: 'pop', widthMm: 350, depthMm: 350, heightMm: 1400, modelType: 'flat', color: '#ef4444', visibility: 'company', tags: ['POP', '스탠드'], version: 1 },
  { name: '배너', category: 'banner', widthMm: 600, depthMm: 10, heightMm: 2000, modelType: 'flat', color: '#0ea5e9', visibility: 'company', tags: ['배너', '현수막'], version: 1 },
  { name: '화분', category: 'plant', widthMm: 400, depthMm: 400, heightMm: 1200, modelType: 'cylinder', color: '#22c55e', visibility: 'company', tags: ['식물', '조경'], version: 1 },
  { name: '성인 사람 실루엣', category: 'human', widthMm: 450, depthMm: 300, heightMm: 1700, modelType: 'cylinder', color: '#64748b', visibility: 'company', tags: ['사람', '스케일'], version: 1 },
  { name: '스포트라이트', category: 'lighting', widthMm: 200, depthMm: 200, heightMm: 150, modelType: 'cylinder', color: '#fde047', visibility: 'company', tags: ['조명', '스팟'], version: 1 },
];

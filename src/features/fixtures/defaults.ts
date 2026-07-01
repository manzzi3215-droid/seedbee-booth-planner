import type { FixtureDef } from '../../types';

/**
 * 기본 집기 목록(시드용).
 * id 는 시드 시점에 부여하므로 여기서는 id 를 제외한 정의만 둡니다.
 */
export type FixtureSeed = Omit<FixtureDef, 'id'>;

export const DEFAULT_FIXTURES: FixtureSeed[] = [
  { name: '진열장', shape: 'rectangle', widthMm: 800, depthMm: 420, heightMm: 1810, color: '#8d6e63' },
  { name: '진열장', shape: 'rectangle', widthMm: 1200, depthMm: 420, heightMm: 1810, color: '#8d6e63' },
  {
    name: '둥근 코너 진열장',
    shape: 'roundedRectangle',
    widthMm: 1200,
    depthMm: 420,
    heightMm: 1810,
    color: '#a1887f',
    cornerRadiusMm: 150,
  },
  { name: 'TV', shape: 'rectangle', widthMm: 1200, depthMm: 200, heightMm: 1600, color: '#37474f' },
  { name: '포스기', shape: 'rectangle', widthMm: 600, depthMm: 500, heightMm: 1000, color: '#546e7a' },
  { name: '수전', shape: 'rectangle', widthMm: 1000, depthMm: 600, heightMm: 900, color: '#4fc3f7' },
  { name: '냉장고', shape: 'rectangle', widthMm: 700, depthMm: 700, heightMm: 1800, color: '#90a4ae' },
  { name: '배너', shape: 'rectangle', widthMm: 600, depthMm: 300, heightMm: 1800, color: '#ef5350' },
  {
    name: '뽑기기계',
    shape: 'roundedRectangle',
    widthMm: 1000,
    depthMm: 1000,
    heightMm: 1800,
    color: '#ffb300',
    cornerRadiusMm: 80,
  },
  { name: '원형 테이블', shape: 'circle', widthMm: 900, depthMm: 900, heightMm: 750, color: '#66bb6a' },
];

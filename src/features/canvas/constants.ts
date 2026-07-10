import type { OpenSide } from '../../types';

/**
 * 캔버스 렌더링 관련 상수.
 * 그리드 간격은 나중에 UI 에서 변경할 수 있도록 여기서 기본값만 정의합니다.
 */

/** 기본 그리드 간격 (mm) */
export const DEFAULT_GRID_SIZE_MM = 500;

/** 화면 맞춤 시 여백 비율 (부스가 컨테이너를 꽉 채우지 않게 여유) */
export const FIT_PADDING = 0.88;

/** 배율(px/mm) 허용 범위 */
export const MIN_SCALE = 0.005;
export const MAX_SCALE = 3;

/** 휠 1회당 확대/축소 비율 */
export const ZOOM_STEP = 1.1;

/** 스크린 고정 크기(px) — 배율과 무관하게 일정하게 보이도록 counter-scale 에 사용 */
export const WALL_STROKE_PX = 7;
export const GRID_STROKE_PX = 1;
export const DIM_LABEL_PX = 13;
export const DIM_LINE_PX = 1;
export const GUIDE_STROKE_PX = 1;

/** 스마트 스냅 임계 거리(mm) — 이 거리 이내면 자동 정렬 */
export const SNAP_THRESHOLD_MM = 50;

export const CANVAS_COLORS = {
  background: '#eef1f5',
  floorFill: '#ffffff',
  grid: '#dbe2ea',
  gridStrong: '#c5cfdb',
  wall: '#6b7280', // 두꺼운 회색 벽체
  dimLine: '#94a3b8',
  dimText: '#475569',
  guide: '#f43f5e', // 스냅 가이드라인 (rose)
  spacing: '#0ea5e9', // 집기 간 간격 치수선 (sky)
  spacingBoundary: '#64748b', // 부스 외곽 경계까지의 간격 (slate)
  spacingLabelBg: 'rgba(15,23,42,0.88)', // 간격 숫자 배경
} as const;

/**
 * 4개 변(edge)의 벽체 여부.
 * true = 벽체(닫힘), false = 오픈(라인 없음).
 * 전시 부스 관례: 뒷면(back)은 항상 벽, 앞면(front)은 항상 오픈.
 *   - 1면 오픈: 앞면만 오픈 (벽 3면)
 *   - 2면 오픈: 앞면 + 오른쪽 오픈 (코너 부스, 벽 2면)
 *   - 3면 오픈: 앞면 + 좌우 오픈 (반도형, 벽 1면=뒷벽)
 */
export interface WallEdges {
  top: boolean; // back
  right: boolean;
  bottom: boolean; // front (아일 방향)
  left: boolean;
}

export function getWallEdges(openSide: OpenSide): WallEdges {
  switch (openSide) {
    case 1:
      return { top: true, right: true, bottom: false, left: true };
    case 2:
      return { top: true, right: false, bottom: false, left: true };
    case 3:
      return { top: true, right: false, bottom: false, left: false };
  }
}

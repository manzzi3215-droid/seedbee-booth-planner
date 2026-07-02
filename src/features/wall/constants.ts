import type { BoothConfig, WallItems, WallSide } from '../../types';
import { getBoothBounds } from '../canvas/boothGeometry';

/** 편집기 보기 모드 (평면도 + 각 벽면) */
export type ViewMode = 'plan' | WallSide;

export const WALL_SIDES: WallSide[] = ['frontWall', 'leftWall', 'rightWall', 'backWall'];

/** 빈 벽면 요소 모음 생성 */
export function emptyWallItems(): WallItems {
  const g = () => ({ texts: [], dimensions: [], images: [] });
  return { frontWall: g(), leftWall: g(), rightWall: g(), backWall: g() };
}

/** 저장된 값(부분/누락) 을 4개 벽면 완전한 형태로 정규화 (하위 호환) */
export function normalizeWallItems(w?: Partial<WallItems>): WallItems {
  const base = emptyWallItems();
  if (!w) return base;
  for (const side of WALL_SIDES) {
    const g = w[side];
    if (g) {
      base[side] = { texts: g.texts ?? [], dimensions: g.dimensions ?? [], images: g.images ?? [] };
    }
  }
  return base;
}

export const VIEW_MODE_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'plan', label: '평면도' },
  { value: 'frontWall', label: '정면 벽' },
  { value: 'leftWall', label: '좌측 벽' },
  { value: 'rightWall', label: '우측 벽' },
  { value: 'backWall', label: '후면 벽' },
];

export function getViewModeLabel(mode: ViewMode): string {
  return VIEW_MODE_OPTIONS.find((o) => o.value === mode)?.label ?? mode;
}

export function isWallView(mode: ViewMode): boolean {
  return mode !== 'plan';
}

/** 해당 벽면이 사용(ON) 상태인지. usedWalls 누락/undefined 는 ON (하위 호환) */
export function isWallEnabled(booth: BoothConfig, side: WallSide): boolean {
  return booth.usedWalls?.[side] !== false;
}

/** 사용(ON) 중인 벽면 목록 */
export function getEnabledWalls(booth: BoothConfig): WallSide[] {
  return WALL_SIDES.filter((s) => isWallEnabled(booth, s));
}

/**
 * 벽면 가로 길이(mm).
 * 정면/후면 = bbox 가로, 좌/우 = bbox 세로.
 * polygon 부스도 이번 단계에서는 bounding box 기준(실제 edge 길이는 추후).
 */
export function getWallLengthMm(booth: BoothConfig, mode: ViewMode): number {
  const b = getBoothBounds(booth);
  if (mode === 'leftWall' || mode === 'rightWall') return b.depthMm;
  return b.widthMm; // frontWall / backWall
}

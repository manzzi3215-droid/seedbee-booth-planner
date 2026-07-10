import type { BoothConfig, WallItems, WallSide } from '../../types';
import { getBoothBounds, getBoothOutline, edgeLengthMm } from '../canvas/boothGeometry';

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

/**
 * 3D/전개도용 벽 실제 변 길이(mm). (v1.1.7)
 *  - rectangle: 해당 변 = getWallLengthMm 와 동일(bbox).
 *  - polygon: 외곽선에서 해당 방향(축)에 가장 잘 맞는 세그먼트들의 길이 합.
 * 3D 렌더러(scene.ts)는 현재 bbox 4벽만 세우므로, 3D 벽 치수는 bbox 기준을 그대로 사용합니다.
 * (실제 polygon 세그먼트 길이는 전개도 라벨/보고용으로만 계산)
 */
export function getWallSegmentLengthMm(booth: BoothConfig, side: WallSide): number {
  if (booth.boothShape !== 'polygon') {
    return getWallLengthMm(booth, side);
  }
  // polygon: 외곽선 변들 중 해당 방향(수평/수직)에 해당하는 변 길이 합산.
  const outline = getBoothOutline(booth);
  const b = getBoothBounds(booth);
  const horizontal = side === 'frontWall' || side === 'backWall';
  // 정면=아래(y 큰) 변, 후면=위(y 작은) 변, 좌=x 작은 변, 우=x 큰 변에 가까운 세그먼트만.
  const nearBand = 0.15; // bbox 크기의 15% 이내를 "그 벽에 속함"으로 판정
  let total = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const c = outline[(i + 1) % outline.length];
    const segLen = edgeLengthMm(a, c);
    if (segLen < 1) continue;
    const midX = (a.xMm + c.xMm) / 2;
    const midY = (a.yMm + c.yMm) / 2;
    const dx = Math.abs(c.xMm - a.xMm);
    const dy = Math.abs(c.yMm - a.yMm);
    if (horizontal) {
      if (dx < dy) continue; // 수평 변만
      const band = b.depthMm * nearBand;
      const target = side === 'frontWall' ? b.maxY : b.minY;
      if (Math.abs(midY - target) <= band) total += segLen;
    } else {
      if (dy < dx) continue; // 수직 변만
      const band = b.widthMm * nearBand;
      const target = side === 'rightWall' ? b.maxX : b.minX;
      if (Math.abs(midX - target) <= band) total += segLen;
    }
  }
  return total > 0 ? Math.round(total) : getWallLengthMm(booth, side);
}

/**
 * 벽면별 색상 해석 (v1.1.7).
 * wallColors[side] 우선, 없으면 레거시 단일 wallColor, 그것도 없으면 undefined(각 렌더러 기본색 사용).
 */
export function getWallColor(booth: BoothConfig, side: WallSide): string | undefined {
  return booth.wallColors?.[side] ?? booth.wallColor;
}

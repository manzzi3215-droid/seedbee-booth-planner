import type { PointMm } from '../../types';
import type { AABB } from './fixtureGeometry';

/**
 * 집기 간격 자동 측정 (v1.1.7).
 *
 * 선택/드래그 중인 집기의 (회전 반영) 바운딩 박스를 기준으로,
 * 상·하·좌·우 4방향 각각에서 "가장 가까운 장애물"까지의 간격(mm)을 구한다.
 *  - 그 방향에 겹치는(수직축 투영이 겹치는) 다른 집기가 있으면 → 집기 간격
 *  - 없으면 → 부스 외곽 경계(outline)까지의 간격 (레이캐스트)
 *
 * 부스 외곽 경계 기준으로 계산하므로 사각형뿐 아니라 polygon/곡선 부스도
 * bounding box 가 아닌 실제 외곽선까지의 거리를 잰다.
 * 모든 좌표/거리는 mm. 렌더링(치수선+숫자)은 BoothCanvas 가 담당한다.
 */

export type SpacingDir = 'left' | 'right' | 'up' | 'down';

export interface SpacingSegment {
  dir: SpacingDir;
  /** 측정 방향 축 (x = 좌우 간격, y = 상하 간격) */
  axis: 'x' | 'y';
  /** 치수선 시작/끝 (mm) */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 숫자 라벨 위치 (mm) */
  midX: number;
  midY: number;
  distMm: number;
  /** 상대 대상: 집기 vs 부스 외곽 경계 */
  kind: 'fixture' | 'boundary';
}

/** 수직축 투영이 이 값(mm) 이하로만 겹치면 "정렬 안 됨"으로 보고 무시 */
const OVERLAP_EPS = 1;
/** 이 값(mm) 미만의 간격(맞닿음/음수)은 표시하지 않음 */
const GAP_EPS = 0.5;

/**
 * origin 에서 dir(단위벡터) 방향으로 레이를 쏴 polygon 외곽선과의 최근접 교차 거리(mm).
 * 교차가 없으면 null. (볼록/오목 모두 지원 — 가장 작은 양수 t 채택)
 */
function rayPolygonDistance(
  origin: { x: number; y: number },
  dir: { x: number; y: number },
  polygon: PointMm[],
): number | null {
  let best: number | null = null;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const ex = b.xMm - a.xMm;
    const ey = b.yMm - a.yMm;
    // origin + t*dir = a + s*e  (0<=s<=1, t>=0)
    const denom = dir.x * ey - dir.y * ex;
    if (Math.abs(denom) < 1e-9) continue; // 평행
    const diffx = a.xMm - origin.x;
    const diffy = a.yMm - origin.y;
    const t = (diffx * ey - diffy * ex) / denom;
    const s = (diffx * dir.y - diffy * dir.x) / denom;
    if (t > GAP_EPS && s >= -1e-6 && s <= 1 + 1e-6) {
      if (best === null || t < best) best = t;
    }
  }
  return best;
}

/** 한 방향의 가장 가까운 간격 세그먼트를 만든다 (없으면 null) */
function measureDir(
  target: AABB,
  others: AABB[],
  outline: PointMm[],
  dir: SpacingDir,
): SpacingSegment | null {
  const horizontal = dir === 'left' || dir === 'right';
  const positive = dir === 'right' || dir === 'down';

  // primary = 측정 방향 축, cross = 수직축(겹침 판정)
  const tPrimMin = horizontal ? target.minX : target.minY;
  const tPrimMax = horizontal ? target.maxX : target.maxY;
  const tCrossMin = horizontal ? target.minY : target.minX;
  const tCrossMax = horizontal ? target.maxY : target.maxX;
  const crossCenter = (tCrossMin + tCrossMax) / 2;

  let best: { gap: number; edge: number; c0: number; c1: number } | null = null;
  for (const o of others) {
    const oPrimMin = horizontal ? o.minX : o.minY;
    const oPrimMax = horizontal ? o.maxX : o.maxY;
    const oCrossMin = horizontal ? o.minY : o.minX;
    const oCrossMax = horizontal ? o.maxY : o.maxX;

    const overlap = Math.min(tCrossMax, oCrossMax) - Math.max(tCrossMin, oCrossMin);
    if (overlap <= OVERLAP_EPS) continue;

    let gap: number;
    let edge: number;
    if (positive) {
      if (oPrimMin < tPrimMax - GAP_EPS) continue; // 진행 방향 앞쪽에 있어야 함
      gap = oPrimMin - tPrimMax;
      edge = oPrimMin;
    } else {
      if (oPrimMax > tPrimMin + GAP_EPS) continue;
      gap = tPrimMin - oPrimMax;
      edge = oPrimMax;
    }
    if (gap < GAP_EPS) continue;
    if (!best || gap < best.gap) {
      best = {
        gap,
        edge,
        c0: Math.max(tCrossMin, oCrossMin),
        c1: Math.min(tCrossMax, oCrossMax),
      };
    }
  }

  let gap: number;
  let edge: number;
  let cross: number;
  let kind: 'fixture' | 'boundary';

  if (best) {
    gap = best.gap;
    edge = best.edge;
    cross = (best.c0 + best.c1) / 2;
    kind = 'fixture';
  } else {
    // 부스 외곽 경계까지 — 집기 해당 변의 중앙에서 방향 레이캐스트
    const tEdge = positive ? tPrimMax : tPrimMin;
    const dirVec = horizontal
      ? { x: positive ? 1 : -1, y: 0 }
      : { x: 0, y: positive ? 1 : -1 };
    const origin = horizontal ? { x: tEdge, y: crossCenter } : { x: crossCenter, y: tEdge };
    const dist = rayPolygonDistance(origin, dirVec, outline);
    if (dist === null || dist < GAP_EPS) return null;
    gap = dist;
    edge = positive ? tEdge + dist : tEdge - dist;
    cross = crossCenter;
    kind = 'boundary';
  }

  const tEdge = positive ? tPrimMax : tPrimMin;
  const mid = (tEdge + edge) / 2;

  if (horizontal) {
    return {
      dir,
      axis: 'x',
      x1: tEdge,
      y1: cross,
      x2: edge,
      y2: cross,
      midX: mid,
      midY: cross,
      distMm: gap,
      kind,
    };
  }
  return {
    dir,
    axis: 'y',
    x1: cross,
    y1: tEdge,
    x2: cross,
    y2: edge,
    midX: cross,
    midY: mid,
    distMm: gap,
    kind,
  };
}

/**
 * 4방향 간격 세그먼트 목록.
 * @param outline 부스 외곽선 폴리곤(mm, 곡선 tessellate 반영). 경계 간격 레이캐스트에 사용.
 */
export function computeSpacing(
  target: AABB,
  others: AABB[],
  outline: PointMm[],
): SpacingSegment[] {
  const dirs: SpacingDir[] = ['left', 'right', 'up', 'down'];
  const out: SpacingSegment[] = [];
  for (const d of dirs) {
    const seg = measureDir(target, others, outline, d);
    if (seg) out.push(seg);
  }
  return out;
}

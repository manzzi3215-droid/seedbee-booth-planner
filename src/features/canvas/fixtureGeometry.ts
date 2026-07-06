import type { FixtureDef, PlacedFixture, PointMm } from '../../types';
import { pointInPolygon } from './boothGeometry';

/**
 * 배치된 집기의 기하 계산.
 * 좌표/치수는 모두 mm 기준이며, 회전(rotationDeg)을 반영해 실제 경계를 구합니다.
 */

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 회전을 반영한 집기의 4개 꼭짓점(mm). 회전축은 좌상단(xMm,yMm) */
export function getFixtureCorners(placed: PlacedFixture, def: FixtureDef): PointMm[] {
  const { xMm: x, yMm: y, rotationDeg } = placed;
  const w = def.widthMm;
  const d = def.depthMm;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [
    [0, 0],
    [w, 0],
    [w, d],
    [0, d],
  ].map(([lx, ly]) => ({
    xMm: x + lx * cos - ly * sin,
    yMm: y + lx * sin + ly * cos,
  }));
}

/**
 * 3D/렌더용 집기 바닥 풋프린트(mm). Shape 에 따라 다각형 근사 (v0.9.1).
 *  - circle: 타원 N각형(원기둥 실루엣)
 *  - 그 외: 바운딩 박스 4점 (getFixtureCorners)
 * 회전축은 좌상단(xMm,yMm).
 */
export function getFixtureFootprint(placed: PlacedFixture, def: FixtureDef, segments = 28): PointMm[] {
  if (def.shape !== 'circle') return getFixtureCorners(placed, def);
  const { xMm: x, yMm: y, rotationDeg } = placed;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = def.widthMm / 2;
  const ry = def.depthMm / 2;
  const pts: PointMm[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const lx = rx + Math.cos(a) * rx; // 로컬 좌표(좌상단 기준 0..w)
    const ly = ry + Math.sin(a) * ry;
    pts.push({ xMm: x + lx * cos - ly * sin, yMm: y + lx * sin + ly * cos });
  }
  return pts;
}

/** 회전을 반영한 축 정렬 경계 상자(AABB, mm) */
export function computeFixtureAABB(placed: PlacedFixture, def: FixtureDef): AABB {
  const corners = getFixtureCorners(placed, def);
  const xs = corners.map((c) => c.xMm);
  const ys = corners.map((c) => c.yMm);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

const EDGE_TOLERANCE_MM = 1;

/**
 * 집기가 부스 폴리곤 밖으로 나갔는지 판정.
 * 집기의 네 꼭짓점을 각각 집기 중심 방향으로 아주 살짝(1mm) 안으로 당긴 뒤
 * 폴리곤 내부인지 검사한다. 벽에 딱 붙은 경우(경계 위)를 밖으로 오판하지 않기 위함.
 */
export function isFixtureOutOfBounds(
  placed: PlacedFixture,
  def: FixtureDef,
  boothPolygon: PointMm[],
): boolean {
  const corners = getFixtureCorners(placed, def);
  const cx = corners.reduce((s, c) => s + c.xMm, 0) / corners.length;
  const cy = corners.reduce((s, c) => s + c.yMm, 0) / corners.length;

  for (const corner of corners) {
    const dx = cx - corner.xMm;
    const dy = cy - corner.yMm;
    const len = Math.hypot(dx, dy) || 1;
    const tx = corner.xMm + (dx / len) * EDGE_TOLERANCE_MM;
    const ty = corner.yMm + (dy / len) * EDGE_TOLERANCE_MM;
    if (!pointInPolygon(tx, ty, boothPolygon)) return true;
  }
  return false;
}

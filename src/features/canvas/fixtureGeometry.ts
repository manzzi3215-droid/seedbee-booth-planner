import type { FixtureDef, PlacedFixture } from '../../types';

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

/** 회전을 반영한 축 정렬 경계 상자(AABB, mm). 회전축은 좌상단(xMm,yMm) */
export function computeFixtureAABB(placed: PlacedFixture, def: FixtureDef): AABB {
  const { xMm: x, yMm: y, rotationDeg } = placed;
  const w = def.widthMm;
  const d = def.depthMm;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    [0, 0],
    [w, 0],
    [w, d],
    [0, d],
  ].map(([lx, ly]) => ({
    X: x + lx * cos - ly * sin,
    Y: y + lx * sin + ly * cos,
  }));

  const xs = corners.map((c) => c.X);
  const ys = corners.map((c) => c.Y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** 집기가 부스 영역(0,0 ~ boothW,boothD) 밖으로 나갔는지 (1mm 오차 허용) */
export function isFixtureOutOfBounds(
  placed: PlacedFixture,
  def: FixtureDef,
  boothW: number,
  boothD: number,
): boolean {
  const b = computeFixtureAABB(placed, def);
  const eps = 1;
  return (
    b.minX < -eps || b.minY < -eps || b.maxX > boothW + eps || b.maxY > boothD + eps
  );
}

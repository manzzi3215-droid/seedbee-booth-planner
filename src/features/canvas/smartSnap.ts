import type { FixtureDef, PlacedFixture } from '../../types';
import { computeFixtureAABB } from './fixtureGeometry';
import type { BoothBounds } from './boothGeometry';

/**
 * 스마트 스냅 계산.
 *
 * 드래그 중인 집기의 (회전 반영) 바운딩 박스 가장자리/중심선을,
 * 다른 집기들의 가장자리/중심선과 부스 바운딩 박스 가장자리/중심선에 정렬한다.
 * x축/y축 각각 독립적으로, threshold(mm) 이내의 가장 가까운 대상에 스냅한다.
 * 모든 좌표는 mm.
 */

export interface SnapGuide {
  axis: 'x' | 'y';
  valueMm: number; // 정렬선 위치(mm)
}

export interface SnapResult {
  xMm: number;
  yMm: number;
  guides: SnapGuide[];
}

export interface SnapTargetFixture {
  placed: PlacedFixture;
  def: FixtureDef;
}

/** 한 축의 정렬 대상 값 목록을 만든다 (가장자리 min/max + 중심) */
function axisTargets(min: number, max: number): number[] {
  return [min, (min + max) / 2, max];
}

/** 한 축에서 가장 가까운 스냅 델타와 정렬선을 찾는다 */
function bestSnap(
  refs: number[], // 드래그 집기의 기준값들 (min, center, max)
  targets: number[], // 정렬 대상 값들
  threshold: number,
): { delta: number; line: number } | null {
  let best: { delta: number; line: number } | null = null;
  for (const ref of refs) {
    for (const t of targets) {
      const delta = t - ref;
      if (Math.abs(delta) <= threshold) {
        if (best === null || Math.abs(delta) < Math.abs(best.delta)) {
          best = { delta, line: t };
        }
      }
    }
  }
  return best;
}

export function computeSmartSnap(
  dragged: PlacedFixture,
  def: FixtureDef,
  others: SnapTargetFixture[],
  booth: BoothBounds,
  thresholdMm: number,
): SnapResult {
  const aabb = computeFixtureAABB(dragged, def);
  const dCenterX = (aabb.minX + aabb.maxX) / 2;
  const dCenterY = (aabb.minY + aabb.maxY) / 2;

  // 정렬 대상 수집
  const targetXs: number[] = [...axisTargets(booth.minX, booth.maxX)];
  const targetYs: number[] = [...axisTargets(booth.minY, booth.maxY)];
  for (const o of others) {
    const ob = computeFixtureAABB(o.placed, o.def);
    targetXs.push(...axisTargets(ob.minX, ob.maxX));
    targetYs.push(...axisTargets(ob.minY, ob.maxY));
  }

  const guides: SnapGuide[] = [];
  let xMm = dragged.xMm;
  let yMm = dragged.yMm;

  const snapX = bestSnap([aabb.minX, dCenterX, aabb.maxX], targetXs, thresholdMm);
  if (snapX) {
    xMm = dragged.xMm + snapX.delta;
    guides.push({ axis: 'x', valueMm: snapX.line });
  }

  const snapY = bestSnap([aabb.minY, dCenterY, aabb.maxY], targetYs, thresholdMm);
  if (snapY) {
    yMm = dragged.yMm + snapY.delta;
    guides.push({ axis: 'y', valueMm: snapY.line });
  }

  return { xMm, yMm, guides };
}

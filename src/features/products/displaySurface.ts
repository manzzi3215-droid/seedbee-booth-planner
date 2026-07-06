import type { FixtureDef, PlacedFixture, PlacedProduct, PointMm, Product } from '../../types';
import { generateGeometry } from '../iso/geometry/GeometryGenerator';
import { pointInPolygon } from '../canvas/boothGeometry';

/**
 * Display Surface (v0.9.4) — 모든 집기는 상판(Top Surface)을 자동으로 가진다.
 * 제품은 항상 이 상판 위에 진열되며, 상판 밖으로 나가면 자동 복귀(clamp)한다.
 * 상판 형태는 Geometry Engine 이 만든 footprint(사각형/원형/곡선/커스텀)를 그대로 사용한다.
 */

const DEFAULT_SURFACE_HEIGHT_MM = 900; // 카운터 기본 높이

export interface DisplaySurface {
  fixtureId: string;
  /** 상판 외곽선(월드 mm) — 집기 shape 그대로 */
  footprint: PointMm[];
  /** 상판 높이(집기 높이) */
  heightMm: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
  /** 곡면(원형/곡선) 여부 */
  curved: boolean;
}

/** 집기의 Display Surface 계산 */
export function getFixtureSurface(pf: PlacedFixture, def: FixtureDef): DisplaySurface {
  const geo = generateGeometry(pf, def);
  const xs = geo.footprint.map((p) => p.xMm);
  const ys = geo.footprint.map((p) => p.yMm);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    fixtureId: pf.id,
    footprint: geo.footprint,
    heightMm: Math.max(1, def.heightMm ?? DEFAULT_SURFACE_HEIGHT_MM),
    minX,
    minY,
    maxX,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    curved: geo.curved,
  };
}

/** 배치 시 대상 집기 선택: 우선 hintFixtureId, 없으면 booth 중심에 가장 가까운 집기 */
export function pickTargetFixture(
  placedFixtures: PlacedFixture[],
  fixturesById: Map<string, FixtureDef>,
  hintFixtureId: string | null,
  boothCx: number,
  boothCy: number,
): { pf: PlacedFixture; def: FixtureDef } | null {
  const valid = placedFixtures
    .map((pf) => ({ pf, def: fixturesById.get(pf.fixtureDefId) }))
    .filter((x): x is { pf: PlacedFixture; def: FixtureDef } => !!x.def);
  if (valid.length === 0) return null;
  if (hintFixtureId) {
    const hit = valid.find((v) => v.pf.id === hintFixtureId);
    if (hit) return hit;
  }
  // booth 중심에 가장 가까운 집기
  return valid.reduce((best, cur) => {
    const s = getFixtureSurface(cur.pf, cur.def);
    const dist = Math.hypot(s.centerX - boothCx, s.centerY - boothCy);
    const bs = getFixtureSurface(best.pf, best.def);
    const bd = Math.hypot(bs.centerX - boothCx, bs.centerY - boothCy);
    return dist < bd ? cur : best;
  });
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * 제품을 상판 안으로 제한(자동 복귀). 제품 중심이 상판 폴리곤 밖이면 bbox 로 클램프.
 * 곡면/폴리곤 상판도 bbox 기준으로 안정적으로 제한.
 */
export function clampToSurface(prod: Product, pp: PlacedProduct, surf: DisplaySurface): { xMm: number; yMm: number } {
  const w = prod.widthMm * pp.scale;
  const d = prod.depthMm * pp.scale;
  const loX = surf.minX;
  const hiX = Math.max(surf.minX, surf.maxX - w);
  const loY = surf.minY;
  const hiY = Math.max(surf.minY, surf.maxY - d);
  let xMm = clamp(pp.xMm, loX, hiX);
  let yMm = clamp(pp.yMm, loY, hiY);
  // 폴리곤(곡면) 상판이면 중심이 폴리곤 안에 들어오도록 한 번 더 보정
  if (surf.curved) {
    const cx = xMm + w / 2;
    const cy = yMm + d / 2;
    if (!pointInPolygon(cx, cy, surf.footprint)) {
      xMm = clamp(surf.centerX - w / 2, loX, hiX);
      yMm = clamp(surf.centerY - d / 2, loY, hiY);
    }
  }
  return { xMm, yMm };
}

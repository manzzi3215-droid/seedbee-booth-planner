import type { BoothConfig, BoothShape, PointMm } from '../../types';

/**
 * 부스 형태 기하 유틸.
 *
 * 핵심 아이디어: 부스를 항상 "폴리곤"으로 다룬다.
 *  - rectangle 은 4개 꼭짓점 폴리곤으로 취급
 *  - polygon 은 polygonPoints 그대로
 * 이렇게 통일하면 캔버스 렌더링/부스 밖 판정/출력 로직이 하나로 합쳐진다.
 * 모든 좌표는 mm.
 */

/** 부스 형태 (없으면 rectangle) */
export function getBoothShape(booth: BoothConfig): BoothShape {
  return booth.boothShape ?? 'rectangle';
}

/** 부스 외곽 폴리곤(꼭짓점, mm). rectangle 은 (0,0)~(w,d) 사각형 */
export function getBoothPolygon(booth: BoothConfig): PointMm[] {
  if (getBoothShape(booth) === 'polygon' && booth.polygonPoints && booth.polygonPoints.length >= 3) {
    return booth.polygonPoints;
  }
  const w = booth.widthMm;
  const d = booth.depthMm;
  return [
    { xMm: 0, yMm: 0 },
    { xMm: w, yMm: 0 },
    { xMm: w, yMm: d },
    { xMm: 0, yMm: d },
  ];
}

/** 각 변의 곡선 bulge(mm). polygonPoints 와 같은 개수 (v1.0.9). 없으면 빈 배열 = 전부 직선 */
export function getBoothCurves(booth: BoothConfig): number[] {
  return booth.edgeCurves ?? [];
}

/** 곡선(bulge) 이 하나라도 있으면 true (v1.0.9) */
export function hasBoothCurves(booth: BoothConfig): boolean {
  return (booth.edgeCurves ?? []).some((c) => Math.abs(c) > 0.5);
}

/**
 * 폴리곤을 곡선(변별 bulge) 반영해 촘촘한 외곽선으로 테셀레이션 (v1.0.9).
 * 변 i(꼭짓점 i→i+1)의 bulge 가 0 이면 직선(시작점만), 아니면 2차 베지어 원호로 분할.
 * bulge 가 전부 0/미지정이면 원본 폴리곤을 그대로 반환 → 기존 동작 100% 동일(무회귀).
 */
export function tessellatePolygon(points: PointMm[], curves: number[], segs = 20): PointMm[] {
  if (points.length < 2 || !curves.some((c) => Math.abs(c) > 0.5)) return points;
  const out: PointMm[] = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const bulge = curves[i] ?? 0;
    out.push({ xMm: a.xMm, yMm: a.yMm });
    if (Math.abs(bulge) <= 0.5) continue; // 직선 변
    // 2차 베지어: 제어점 = 변 중점 + 법선 * (2*bulge) → 곡선 정점 offset ≈ bulge
    const mx = (a.xMm + b.xMm) / 2;
    const my = (a.yMm + b.yMm) / 2;
    const dx = b.xMm - a.xMm;
    const dy = b.yMm - a.yMm;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dy / len; // 오른손 법선
    const ny = -dx / len;
    const cxp = mx + nx * bulge * 2;
    const cyp = my + ny * bulge * 2;
    for (let s = 1; s < segs; s++) {
      const t = s / segs;
      const mt = 1 - t;
      out.push({
        xMm: mt * mt * a.xMm + 2 * mt * t * cxp + t * t * b.xMm,
        yMm: mt * mt * a.yMm + 2 * mt * t * cyp + t * t * b.yMm,
      });
    }
  }
  return out;
}

/**
 * 부스 외곽선(렌더/클립/판정용, mm) — 곡선을 반영해 테셀레이션한 폴리곤 (v1.0.9).
 * 곡선이 없으면 getBoothPolygon 과 동일한 점 배열을 반환합니다.
 */
export function getBoothOutline(booth: BoothConfig, segs = 20): PointMm[] {
  return tessellatePolygon(getBoothPolygon(booth), getBoothCurves(booth), segs);
}

export interface BoothBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  depthMm: number;
}

/**
 * 부스 외곽선의 바운딩 박스(mm).
 * 곡선(edgeCurves)이 있으면 테셀레이션된 외곽선 기준 → 화면(2D)·3D·출력·치수가 모두 동일한 extent 사용.
 * 곡선이 없으면 getBoothOutline == 원본 폴리곤이라 무회귀. (v1.2.4)
 */
export function getBoothBounds(booth: BoothConfig): BoothBounds {
  const pts = getBoothOutline(booth);
  const xs = pts.map((p) => p.xMm);
  const ys = pts.map((p) => p.yMm);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, widthMm: maxX - minX, depthMm: maxY - minY };
}

/** 점이 폴리곤 내부인지 (ray casting) */
export function pointInPolygon(x: number, y: number, polygon: PointMm[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].xMm;
    const yi = polygon[i].yMm;
    const xj = polygon[j].xMm;
    const yj = polygon[j].yMm;
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 폴리곤 꼭짓점을 Konva points 배열([x0,y0,x1,y1,...])로 평탄화 */
export function flattenPolygon(polygon: PointMm[]): number[] {
  return polygon.flatMap((p) => [p.xMm, p.yMm]);
}

/** 폴리곤 넓이(mm², shoelace) */
export function polygonAreaMm2(pts: PointMm[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].xMm * pts[j].yMm - pts[j].xMm * pts[i].yMm;
  }
  return Math.abs(a) / 2;
}

/** 두 점 사이 거리(mm) */
export function edgeLengthMm(a: PointMm, b: PointMm): number {
  return Math.hypot(b.xMm - a.xMm, b.yMm - a.yMm);
}

/** 꼭짓점 내부 각도(도). prev-cur-next */
export function cornerAngleDeg(prev: PointMm, cur: PointMm, next: PointMm): number {
  const v1x = prev.xMm - cur.xMm;
  const v1y = prev.yMm - cur.yMm;
  const v2x = next.xMm - cur.xMm;
  const v2y = next.yMm - cur.yMm;
  const dot = v1x * v2x + v1y * v2y;
  const m = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) || 1;
  const ang = (Math.acos(Math.max(-1, Math.min(1, dot / m))) * 180) / Math.PI;
  return Math.round(ang);
}

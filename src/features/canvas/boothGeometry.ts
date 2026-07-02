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

export interface BoothBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  widthMm: number;
  depthMm: number;
}

/** 부스 폴리곤의 바운딩 박스(mm) */
export function getBoothBounds(booth: BoothConfig): BoothBounds {
  const pts = getBoothPolygon(booth);
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

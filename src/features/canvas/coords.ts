import { FIT_PADDING, MIN_SCALE, MAX_SCALE } from './constants';

/**
 * 좌표 변환 유틸.
 *
 * 캔버스 내부 좌표는 항상 mm 기준으로 관리하고, 화면(px) 변환은 여기서만 처리합니다.
 * Konva Stage 의 (scale, x, y) 를 그대로 Viewport 로 사용합니다.
 *   - scale: px per mm
 *   - x, y : stage 오프셋(px)
 *
 * 스크린 좌표 = mm * scale + offset
 * mm 좌표     = (스크린 - offset) / scale
 *
 * 이 함수들은 5·6단계에서 집기를 mm 좌표로 배치/저장할 때 재사용됩니다.
 */
export interface Viewport {
  scale: number; // px per mm
  x: number; // stage offset px
  y: number; // stage offset px
}

export interface PxPoint {
  x: number;
  y: number;
}

export interface MmPoint {
  xMm: number;
  yMm: number;
}

/** mm → 스크린 px */
export function mmToScreen(p: MmPoint, vp: Viewport): PxPoint {
  return { x: p.xMm * vp.scale + vp.x, y: p.yMm * vp.scale + vp.y };
}

/** 스크린 px → mm (예: 마우스 포인터 위치를 mm 로) */
export function screenToMm(p: PxPoint, vp: Viewport): MmPoint {
  return { xMm: (p.x - vp.x) / vp.scale, yMm: (p.y - vp.y) / vp.scale };
}

/** px 길이를 mm 길이로 (배율과 무관한 고정 크기 요소 계산용) */
export function pxToMm(px: number, vp: Viewport): number {
  return px / vp.scale;
}

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** mm 값을 그리드 간격(mm)에 맞춰 스냅 */
export function snapMmToGrid(mm: number, gridMm: number): number {
  if (gridMm <= 0) return mm;
  return Math.round(mm / gridMm) * gridMm;
}

/**
 * 컨테이너 크기에 맞춰 부스 전체가 보이도록 하는 Viewport 계산(화면 맞춤).
 * 부스 바운딩 박스가 원점(0,0)에서 시작하지 않을 수 있으므로 minX/minY 오프셋을 받는다.
 */
export function computeFit(
  containerW: number,
  containerH: number,
  boothWMm: number,
  boothDMm: number,
  minXMm = 0,
  minYMm = 0,
): Viewport {
  if (boothWMm <= 0 || boothDMm <= 0 || containerW <= 0 || containerH <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }
  const scale = clampScale(
    Math.min(containerW / boothWMm, containerH / boothDMm) * FIT_PADDING,
  );
  return {
    scale,
    // 부스 점 (minX,minY) 이 여백 시작점에 오도록 오프셋 보정
    x: (containerW - boothWMm * scale) / 2 - minXMm * scale,
    y: (containerH - boothDMm * scale) / 2 - minYMm * scale,
  };
}

/**
 * 포인터 위치를 중심으로 확대/축소한 새 Viewport.
 * factor > 1 이면 확대, < 1 이면 축소.
 */
export function zoomAtPoint(vp: Viewport, pointer: PxPoint, factor: number): Viewport {
  const newScale = clampScale(vp.scale * factor);
  // 포인터가 가리키는 mm 지점이 확대 후에도 같은 스크린 위치에 오도록 오프셋 보정
  const mmAtPointer = screenToMm(pointer, vp);
  return {
    scale: newScale,
    x: pointer.x - mmAtPointer.xMm * newScale,
    y: pointer.y - mmAtPointer.yMm * newScale,
  };
}

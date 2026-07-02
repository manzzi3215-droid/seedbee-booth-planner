import type { PlacedDimension } from '../../types';
import { TEXT_FONT_FAMILY } from '../texts/constants';

/** 새 치수선 기본값 (길이 mm) */
export const DEFAULT_DIMENSION_LENGTH_MM = 2000;
export const DEFAULT_DIMENSION_COLOR = '#334155';
export const DEFAULT_DIMENSION_TEXT_COLOR = '#0f172a';
export const DEFAULT_DIMENSION_LINE_WIDTH_PX = 1.5;

/** 치수 텍스트 폰트(한글/숫자) — 텍스트 요소와 동일 스택 재사용 */
export const DIMENSION_FONT_FAMILY = TEXT_FONT_FAMILY;

/** 두 점 사이 거리(mm) */
export function dimensionLengthMm(d: PlacedDimension): number {
  return Math.hypot(d.endXMm - d.startXMm, d.endYMm - d.startYMm);
}

/** 표시 라벨: label 이 있으면 우선, 없으면 자동 길이 */
export function dimensionDisplayLabel(d: PlacedDimension): string {
  const custom = d.label?.trim();
  if (custom) return custom;
  return `${Math.round(dimensionLengthMm(d))} mm`;
}

import type { SvgDocument, SvgElement, SvgElementType, SvgViewBox } from '../../types';

/**
 * SvgModel — SVG 문서/도형의 데이터 모델과 유틸.
 * (역할 분리: Parser 가 만든 모델을 Renderer/Inspector/Converter 가 소비)
 */

export type { SvgDocument, SvgElement, SvgElementType, SvgViewBox };

/** Inspector 표시 순서용 지원 요소 목록 */
export const SVG_ELEMENT_TYPES: SvgElementType[] = [
  'path',
  'rect',
  'circle',
  'ellipse',
  'polygon',
  'polyline',
  'line',
  'text',
];

/** 요소 타입 한글 라벨 */
export const SVG_ELEMENT_LABEL: Record<SvgElementType, string> = {
  path: 'Path',
  rect: 'Rect',
  circle: 'Circle',
  ellipse: 'Ellipse',
  polygon: 'Polygon',
  polyline: 'Polyline',
  line: 'Line',
  text: 'Text',
};

export interface SvgElementCounts {
  byType: Record<SvgElementType, number>;
  total: number;
}

/** mm 사각형 (평면도 배치 환산 결과) */
export interface RectMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/** 문서 전체 배치 사각형(mm) */
export function documentRectMm(doc: SvgDocument): RectMm {
  return { xMm: doc.xMm, yMm: doc.yMm, widthMm: doc.widthMm, heightMm: doc.heightMm };
}

/** 정규화 bbox(fx,fy,fw,fh) → mm 사각형 */
export function elementRectMm(doc: SvgDocument, el: SvgElement): RectMm {
  return {
    xMm: doc.xMm + el.fx * doc.widthMm,
    yMm: doc.yMm + el.fy * doc.heightMm,
    widthMm: el.fw * doc.widthMm,
    heightMm: el.fh * doc.heightMm,
  };
}

/**
 * 요소가 문서(viewBox)의 대부분을 차지하는지 — 배경/아트보드로 추정.
 * 가로·세로 모두 80% 이상이면 배경일 가능성이 높습니다. (대형 Rect 오변환 방지)
 */
export function isLikelyBackgroundElement(el: SvgElement): boolean {
  return el.fw >= 0.8 && el.fh >= 0.8;
}

/** 문서 내 요소 타입별 개수 + 총합 */
export function countElements(doc: SvgDocument): SvgElementCounts {
  const byType = {
    path: 0,
    rect: 0,
    circle: 0,
    ellipse: 0,
    polygon: 0,
    polyline: 0,
    line: 0,
    text: 0,
  } as Record<SvgElementType, number>;
  for (const el of doc.elements) byType[el.type] += 1;
  return { byType, total: doc.elements.length };
}

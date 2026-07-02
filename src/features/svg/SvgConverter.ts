import type { FixtureDef, SvgDocument, SvgElement } from '../../types';
import { generateId } from '../../utils/id';
import { elementRectMm, SVG_ELEMENT_LABEL } from './SvgModel';

/**
 * SvgConverter — SvgElement 를 앱 도메인 객체(집기/치수선)로 변환.
 *
 * 변환 규칙 (v0.7.1):
 *   rect      → rectangle 집기
 *   circle    → circle 집기
 *   ellipse   → customPath 집기 (타원 path)
 *   polygon   → customPath 집기 (닫힌 path)
 *   polyline  → customPath 집기 (열린 path)
 *   path      → customPath 집기 (path 를 샘플링해 100×100 정규화)
 *   line      → 치수선(Dimension)
 *   text      → (아직 변환 안 함)
 *
 * ⚠️ 이번 단계는 "SVG → Canvas" 까지입니다. Fixture Library 저장은 하지 않습니다(v0.7.2).
 */

const DEFAULT_COLOR = '#9ca3af';
/** customPath 좌표 박스 (shapes.ts CUSTOM_PATH_VIEW 와 동일) */
const VIEW = 100;

/** 변환 가능 여부 (text 제외) */
export function isConvertible(el: SvgElement): boolean {
  return el.type !== 'text' && !el.converted;
}

/** 자동 이름: 같은 타입 요소 중 몇 번째인지 (예: Rect 1, Circle 1, Path 8) */
export function autoFixtureName(doc: SvgDocument, el: SvgElement): string {
  let ordinal = 0;
  for (const e of doc.elements) {
    if (e.type === el.type) {
      ordinal += 1;
      if (e.id === el.id) break;
    }
  }
  return `${SVG_ELEMENT_LABEL[el.type]} ${ordinal}`;
}

/** fill 우선, 없으면 stroke, 둘 다 없으면 기본 회색 */
function resolveColor(el: SvgElement): string {
  const usable = (c?: string) => !!c && c !== 'none' && c !== 'transparent';
  if (usable(el.fill)) return el.fill;
  if (usable(el.stroke)) return el.stroke;
  return DEFAULT_COLOR;
}

/** 점 목록을 자기 bbox 기준 0~100 정규화 path 로 */
function pointsToNormalizedPath(pts: number[][], close: boolean): string | null {
  if (pts.length < 2) return null;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX || 1;
  const h = Math.max(...ys) - minY || 1;
  const nx = (x: number) => (((x - minX) / w) * VIEW).toFixed(2);
  const ny = (y: number) => (((y - minY) / h) * VIEW).toFixed(2);
  let d = `M${nx(pts[0][0])},${ny(pts[0][1])}`;
  for (let i = 1; i < pts.length; i++) d += ` L${nx(pts[i][0])},${ny(pts[i][1])}`;
  if (close) d += ' Z';
  return d;
}

/** points 속성 문자열 파싱 → [[x,y],...] */
function parsePoints(pointsAttr?: string): number[][] {
  if (!pointsAttr) return [];
  const nums = pointsAttr.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  const pts: number[][] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
  return pts;
}

/** SVG path(d) 를 브라우저로 샘플링해 0~100 정규화 닫힌 path 로 */
function pathToNormalizedPath(dAttr?: string): string | null {
  if (!dAttr) return null;
  const svgns = 'http://www.w3.org/2000/svg';
  const holder = document.createElement('div');
  holder.setAttribute('style', 'position:absolute;left:-99999px;top:0;visibility:hidden;');
  const svg = document.createElementNS(svgns, 'svg');
  const pathEl = document.createElementNS(svgns, 'path');
  pathEl.setAttribute('d', dAttr);
  svg.appendChild(pathEl);
  holder.appendChild(svg);
  document.body.appendChild(holder);
  try {
    const len = pathEl.getTotalLength();
    if (!len || !Number.isFinite(len)) return null;
    const N = 96;
    const pts: number[][] = [];
    for (let i = 0; i <= N; i++) {
      const pt = pathEl.getPointAtLength((len * i) / N);
      pts.push([pt.x, pt.y]);
    }
    return pointsToNormalizedPath(pts, true);
  } catch {
    return null;
  } finally {
    document.body.removeChild(holder);
  }
}

/** 타원 path (0~100 박스를 채우는 타원) */
function ellipsePath(): string {
  return 'M0,50 A50,50 0 0 1 100,50 A50,50 0 0 1 0,50 Z';
}

export interface FixtureConversion {
  kind: 'fixture';
  def: FixtureDef;
  xMm: number;
  yMm: number;
}
export interface DimensionConversion {
  kind: 'dimension';
  startXMm: number;
  startYMm: number;
  endXMm: number;
  endYMm: number;
  color: string;
}
export type ConversionOutput = FixtureConversion | DimensionConversion | null;

/**
 * SvgElement 하나를 변환 결과로. 실패/미지원 시 null.
 */
export function convertSvgElement(doc: SvgDocument, el: SvgElement): ConversionOutput {
  if (!isConvertible(el)) return null;
  const r = elementRectMm(doc, el);
  const color = resolveColor(el);
  const name = autoFixtureName(doc, el);
  const widthMm = Math.max(1, Math.round(r.widthMm));
  const depthMm = Math.max(1, Math.round(r.heightMm));

  const baseDef = (extra: Partial<FixtureDef>): FixtureDef => ({
    id: generateId(),
    name,
    shape: 'rectangle',
    widthMm,
    depthMm,
    color,
    ...extra,
  });

  const asFixture = (def: FixtureDef): FixtureConversion => ({
    kind: 'fixture',
    def,
    xMm: Math.round(r.xMm),
    yMm: Math.round(r.yMm),
  });

  switch (el.type) {
    case 'rect':
      return asFixture(baseDef({ shape: 'rectangle' }));
    case 'circle':
      return asFixture(baseDef({ shape: 'circle' }));
    case 'ellipse':
      return asFixture(baseDef({ shape: 'customPath', svgPath: ellipsePath() }));
    case 'polygon': {
      const path = pointsToNormalizedPath(parsePoints(el.attrs.points), true);
      return path ? asFixture(baseDef({ shape: 'customPath', svgPath: path })) : null;
    }
    case 'polyline': {
      const path = pointsToNormalizedPath(parsePoints(el.attrs.points), false);
      return path ? asFixture(baseDef({ shape: 'customPath', svgPath: path })) : null;
    }
    case 'path': {
      const path = pathToNormalizedPath(el.attrs.d);
      return path ? asFixture(baseDef({ shape: 'customPath', svgPath: path })) : null;
    }
    case 'line': {
      // bbox 대각선에서 실제 방향을 x1/y1/x2/y2 로 판별
      const x0 = r.xMm;
      const y0 = r.yMm;
      const x1m = r.xMm + r.widthMm;
      const y1m = r.yMm + r.heightMm;
      const rx1 = Number(el.attrs.x1);
      const ry1 = Number(el.attrs.y1);
      const rx2 = Number(el.attrs.x2);
      const ry2 = Number(el.attrs.y2);
      let sx = x0;
      let sy = y0;
      let ex = x1m;
      let ey = y1m;
      if ([rx1, ry1, rx2, ry2].every(Number.isFinite)) {
        const sameDir = rx1 <= rx2 === (ry1 <= ry2);
        if (!sameDir) {
          sx = x1m;
          sy = y0;
          ex = x0;
          ey = y1m;
        }
      }
      return {
        kind: 'dimension',
        startXMm: Math.round(sx),
        startYMm: Math.round(sy),
        endXMm: Math.round(ex),
        endYMm: Math.round(ey),
        color,
      };
    }
    default:
      return null;
  }
}

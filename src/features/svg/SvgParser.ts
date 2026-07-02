import type { SvgDocument, SvgElement, SvgElementType, SvgViewBox } from '../../types';
import { generateId } from '../../utils/id';
import { SVG_ELEMENT_TYPES } from './SvgModel';

/**
 * SvgParser — SVG 문자열을 SvgDocument(구조 객체)로 변환.
 *
 * bbox 는 브라우저 렌더 결과(getBoundingClientRect)를 이용해 "문서 대비 정규화 좌표"로
 * 계산합니다. 이렇게 하면 element 의 transform / 중첩 group / viewBox 를 직접 계산하지
 * 않고도 정확한 위치를 얻을 수 있습니다. (AI 파일은 직접 읽지 않고 SVG 저장본만 처리)
 */

const SUPPORTED = new Set<string>(SVG_ELEMENT_TYPES);

/** "10px" / "10mm" / "10" → 숫자(단위 무시) */
function toNumber(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

function parseViewBox(svg: SVGSVGElement, w: number, h: number): SvgViewBox {
  const vb = svg.getAttribute('viewBox');
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts.every((p) => Number.isFinite(p)) && parts[2] > 0 && parts[3] > 0) {
      return { minX: parts[0], minY: parts[1], width: parts[2], height: parts[3] };
    }
  }
  return { minX: 0, minY: 0, width: w, height: h };
}

function collectAttrs(node: Element): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(node.attributes)) attrs[a.name] = a.value;
  return attrs;
}

/**
 * SVG 문자열을 파싱해 SvgDocument 로 반환.
 * @param svgText  SVG 원본 문자열
 * @param name     문서 이름(파일명 등)
 * @param srcDataUrl 미리보기용 dataURL (원본 SVG)
 * @param placement 평면도 배치(mm) — 좌상단/크기
 */
export function parseSvgDocument(
  svgText: string,
  name: string,
  srcDataUrl: string,
  placement: { xMm: number; yMm: number; widthMm: number; heightMm: number },
): SvgDocument {
  const parsed = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (parsed.querySelector('parsererror')) {
    throw new Error('SVG 파싱에 실패했습니다. 올바른 SVG 파일인지 확인하세요.');
  }
  const svg = parsed.querySelector('svg');
  if (!svg) throw new Error('유효한 <svg> 요소를 찾지 못했습니다.');

  const attrW = toNumber(svg.getAttribute('width'), 0);
  const attrH = toNumber(svg.getAttribute('height'), 0);
  const viewBox = parseViewBox(svg, attrW || 1000, attrH || 1000);
  const docWidth = attrW || viewBox.width;
  const docHeight = attrH || viewBox.height;

  // 측정용으로 DOM 에 임시 부착 (getBoundingClientRect 는 레이아웃 필요)
  const holder = document.createElement('div');
  holder.setAttribute(
    'style',
    'position:absolute;left:-99999px;top:0;width:auto;height:auto;visibility:hidden;pointer-events:none;',
  );
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('width', String(docWidth));
  clone.setAttribute('height', String(docHeight));
  holder.appendChild(clone);
  document.body.appendChild(holder);

  const elements: SvgElement[] = [];
  try {
    const rootRect = clone.getBoundingClientRect();
    const rw = rootRect.width || docWidth || 1;
    const rh = rootRect.height || docHeight || 1;
    const nodes = clone.querySelectorAll(SVG_ELEMENT_TYPES.join(','));
    nodes.forEach((node) => {
      const tag = node.tagName.toLowerCase();
      if (!SUPPORTED.has(tag)) return;
      const type = tag as SvgElementType;
      let r: DOMRect;
      try {
        r = (node as SVGGraphicsElement).getBoundingClientRect();
      } catch {
        return;
      }
      const attrs = collectAttrs(node);
      elements.push({
        id: generateId(),
        type,
        stroke: attrs.stroke ?? (node as SVGElement).style?.stroke ?? 'none',
        fill: attrs.fill ?? (node as SVGElement).style?.fill ?? 'none',
        transform: attrs.transform,
        attrs,
        text: type === 'text' ? (node.textContent ?? '').trim() : undefined,
        fx: (r.left - rootRect.left) / rw,
        fy: (r.top - rootRect.top) / rh,
        fw: r.width / rw,
        fh: r.height / rh,
      });
    });
  } finally {
    document.body.removeChild(holder);
  }

  const now = Date.now();
  return {
    id: generateId(),
    name,
    srcDataUrl,
    docWidth,
    docHeight,
    viewBox,
    elements,
    xMm: placement.xMm,
    yMm: placement.yMm,
    widthMm: placement.widthMm,
    heightMm: placement.heightMm,
    createdAt: now,
    updatedAt: now,
  };
}

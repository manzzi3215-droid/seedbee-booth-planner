import { Group, Rect } from 'react-konva';
import type { SvgDocument } from '../../types';
import { documentRectMm, elementRectMm } from './SvgModel';

/**
 * SvgRenderer — 선택된 SvgDocument/SvgElement 를 캔버스에 하이라이트로 그립니다.
 * (mm 환산은 SvgModel 이 담당)
 *
 * ⚠️ 이번 버전(v0.7.0)은 "읽기"만 담당합니다. 문서 자체는 그리지 않고
 * (요구사항: 아직 화면에 그리지 않아도 됨), 선택 시 참조용 외곽 + 도형 하이라이트만
 * 표시합니다. Stage 트리 내부 컴포넌트이므로 React 훅을 사용하지 않습니다.
 */

interface SvgHighlightOverlayProps {
  doc: SvgDocument;
  highlightedElementId: string | null;
  /** 화면 배율(px/mm) — 선/두께를 배율과 무관하게 유지 */
  scale: number;
}

/**
 * 선택된 SVG 문서의 참조 외곽 + (선택 시) 도형 하이라이트.
 * listening=false 레이어에서 사용되어 편집 상호작용에 영향을 주지 않습니다.
 */
export default function SvgHighlightOverlay({ doc, highlightedElementId, scale }: SvgHighlightOverlayProps) {
  const docR = documentRectMm(doc);
  const minPx = 2; // 하이라이트 최소 두께(px) → mm
  const minMm = minPx / Math.max(scale, 0.0001);
  const hl = highlightedElementId ? doc.elements.find((e) => e.id === highlightedElementId) : null;
  const elR = hl ? elementRectMm(doc, hl) : null;

  return (
    <Group listening={false}>
      {/* 문서 참조 외곽 (연한 점선) */}
      <Rect
        x={docR.xMm}
        y={docR.yMm}
        width={docR.widthMm}
        height={docR.heightMm}
        stroke="#8b5cf6"
        strokeWidth={1.25}
        strokeScaleEnabled={false}
        dash={[6, 5]}
        opacity={0.6}
      />
      {/* 선택 도형 하이라이트 */}
      {elR && (
        <Rect
          x={elR.xMm}
          y={elR.yMm}
          width={Math.max(elR.widthMm, minMm)}
          height={Math.max(elR.heightMm, minMm)}
          stroke="#f97316"
          strokeWidth={2.25}
          strokeScaleEnabled={false}
          fill="rgba(249,115,22,0.14)"
        />
      )}
    </Group>
  );
}

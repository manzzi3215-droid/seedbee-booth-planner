import { Circle, Group, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { PointMm } from '../../types';
import { edgeLengthMm, cornerAngleDeg } from './boothGeometry';

/**
 * 부스 외곽 편집 오버레이 (CAD 스타일). 편집 모드에서만 렌더링됩니다.
 * - 꼭짓점(Circle) 드래그 · 선택
 * - 각 Edge 중앙 [+] 핸들 → 새 꼭짓점 추가
 * - Edge(Line) 드래그 → 양쪽 꼭짓점 함께 이동
 * - Edge hover 시 길이(mm) 표시, 선택 꼭짓점 각도 표시
 *
 * 실제 드래그 좌표 계산(회전 포함)은 부모(BoothCanvas)가 layer.getRelativePointerPosition()
 * 으로 처리하고, 이 컴포넌트는 표시와 이벤트 시작만 담당합니다.
 */
export default function ShapeEditor({
  points,
  curves,
  scale,
  selectedVertex,
  hoverEdge,
  onVertexDown,
  onEdgeDown,
  onAddVertex,
  onCurveDown,
  onEdgeEnter,
  onEdgeLeave,
}: {
  points: PointMm[];
  /** 변별 곡선 bulge(mm) — v1.0.9 (points 와 같은 개수) */
  curves: number[];
  scale: number;
  selectedVertex: number | null;
  hoverEdge: number | null;
  onVertexDown: (index: number, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onEdgeDown: (index: number, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onAddVertex: (edgeIndex: number, e: Konva.KonvaEventObject<MouseEvent>) => void;
  /** 곡선(bulge) 핸들 드래그 시작 — v1.0.9 */
  onCurveDown: (edgeIndex: number, e: Konva.KonvaEventObject<MouseEvent>) => void;
  onEdgeEnter: (index: number) => void;
  onEdgeLeave: () => void;
}) {
  const px = (v: number) => v / scale; // 화면 고정 px → mm
  const n = points.length;

  // 변 i(a→b)의 법선(오른손) 단위벡터
  const edgeNormal = (a: PointMm, b: PointMm) => {
    const dx = b.xMm - a.xMm;
    const dy = b.yMm - a.yMm;
    const len = Math.hypot(dx, dy) || 1;
    return { nx: dy / len, ny: -dx / len, len };
  };
  // 곡선 변을 2차 베지어로 샘플링한 화면 점 배열 (곡선 표시용)
  const edgeLinePoints = (a: PointMm, b: PointMm, bulge: number): number[] => {
    if (Math.abs(bulge) <= 0.5) return [a.xMm, a.yMm, b.xMm, b.yMm];
    const mx = (a.xMm + b.xMm) / 2;
    const my = (a.yMm + b.yMm) / 2;
    const { nx, ny } = edgeNormal(a, b);
    const cx = mx + nx * bulge * 2;
    const cy = my + ny * bulge * 2;
    const out: number[] = [];
    const SEG = 18;
    for (let s = 0; s <= SEG; s++) {
      const t = s / SEG;
      const mt = 1 - t;
      out.push(mt * mt * a.xMm + 2 * mt * t * cx + t * t * b.xMm);
      out.push(mt * mt * a.yMm + 2 * mt * t * cy + t * t * b.yMm);
    }
    return out;
  };

  return (
    <Group>
      {/* Edge 라인 (곡선 반영 · 드래그 + hover 길이) */}
      {points.map((a, i) => {
        const b = points[(i + 1) % n];
        return (
          <Line
            key={`edge-${i}`}
            points={edgeLinePoints(a, b, curves[i] ?? 0)}
            stroke={hoverEdge === i ? '#2563eb' : '#3b82f6'}
            strokeWidth={hoverEdge === i ? 3 : 2}
            strokeScaleEnabled={false}
            hitStrokeWidth={14}
            onMouseEnter={() => onEdgeEnter(i)}
            onMouseLeave={onEdgeLeave}
            onMouseDown={(e) => onEdgeDown(i, e)}
          />
        );
      })}

      {/* Edge 중앙 [+] 추가 핸들 */}
      {points.map((a, i) => {
        const b = points[(i + 1) % n];
        const mx = (a.xMm + b.xMm) / 2;
        const my = (a.yMm + b.yMm) / 2;
        const r = px(8);
        return (
          <Group key={`add-${i}`} x={mx} y={my} onMouseDown={(e) => onAddVertex(i, e)}>
            <Circle radius={r} fill="#ffffff" stroke="#2563eb" strokeWidth={1.5} strokeScaleEnabled={false} />
            <Line points={[-px(4), 0, px(4), 0]} stroke="#2563eb" strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />
            <Line points={[0, -px(4), 0, px(4)]} stroke="#2563eb" strokeWidth={1.5} strokeScaleEnabled={false} listening={false} />
          </Group>
        );
      })}

      {/* Edge 곡선(bulge) 핸들 — 주황, 중점에서 법선 방향으로 드래그 (v1.0.9) */}
      {points.map((a, i) => {
        const b = points[(i + 1) % n];
        const mx = (a.xMm + b.xMm) / 2;
        const my = (a.yMm + b.yMm) / 2;
        const { nx, ny } = edgeNormal(a, b);
        const bulge = curves[i] ?? 0;
        const off = Math.abs(bulge) > 0.5 ? bulge : px(20); // 직선이면 바깥쪽으로 살짝 띄움
        const hx = mx + nx * off;
        const hy = my + ny * off;
        return (
          <Group key={`curve-${i}`}>
            <Line points={[mx, my, hx, hy]} stroke="#f59e0b" strokeWidth={1} strokeScaleEnabled={false} dash={[px(4), px(3)]} listening={false} />
            <Circle x={hx} y={hy} radius={px(7)} fill="#f59e0b" stroke="#ffffff" strokeWidth={1.5} strokeScaleEnabled={false} onMouseDown={(e) => onCurveDown(i, e)} />
          </Group>
        );
      })}

      {/* 꼭짓점 */}
      {points.map((p, i) => {
        const selected = selectedVertex === i;
        return (
          <Circle
            key={`v-${i}`}
            x={p.xMm}
            y={p.yMm}
            radius={px(selected ? 8 : 6)}
            fill={selected ? '#2563eb' : '#ffffff'}
            stroke="#2563eb"
            strokeWidth={2}
            strokeScaleEnabled={false}
            onMouseDown={(e) => onVertexDown(i, e)}
          />
        );
      })}

      {/* Edge hover 길이 라벨 */}
      {hoverEdge != null && (() => {
        const a = points[hoverEdge];
        const b = points[(hoverEdge + 1) % n];
        const mx = (a.xMm + b.xMm) / 2;
        const my = (a.yMm + b.yMm) / 2;
        const label = `${Math.round(edgeLengthMm(a, b))} mm`;
        const fontMm = px(13);
        const w = label.length * fontMm * 0.62 + px(10);
        return (
          <Group x={mx} y={my - px(18)} listening={false}>
            <Rect x={-w / 2} y={-fontMm * 0.9} width={w} height={fontMm * 1.7} fill="#111827" cornerRadius={px(4)} />
            <Text text={label} x={-w / 2} y={-fontMm * 0.65} width={w} align="center" fontSize={fontMm} fill="#ffffff" />
          </Group>
        );
      })()}

      {/* 선택 꼭짓점 각도 라벨 */}
      {selectedVertex != null && n >= 3 && (() => {
        const cur = points[selectedVertex];
        const prev = points[(selectedVertex - 1 + n) % n];
        const next = points[(selectedVertex + 1) % n];
        const fontMm = px(12);
        const label = `${cornerAngleDeg(prev, cur, next)}°`;
        return (
          <Group x={cur.xMm} y={cur.yMm + px(16)} listening={false}>
            <Rect x={-px(16)} y={0} width={px(32)} height={fontMm * 1.6} fill="#f59e0b" cornerRadius={px(3)} />
            <Text text={label} x={-px(16)} y={fontMm * 0.3} width={px(32)} align="center" fontSize={fontMm} fill="#111827" />
          </Group>
        );
      })()}
    </Group>
  );
}

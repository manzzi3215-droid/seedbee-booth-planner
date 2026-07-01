import { Group, Rect, Ellipse, Line } from 'react-konva';
import type Konva from 'konva';
import type { FixtureDef, PlacedFixture } from '../../types';
import { isFixtureOutOfBounds } from './fixtureGeometry';

const SELECT_COLOR = '#2563eb';
const WARN_COLOR = '#dc2626';
const OUTLINE = 'rgba(0,0,0,0.35)';

/** 형태별 도형 렌더링 (mm 좌표) */
function ShapeBody({ def }: { def: FixtureDef }) {
  const { shape, widthMm: w, depthMm: d, color, cornerRadiusMm } = def;

  switch (shape) {
    case 'rectangle':
      return (
        <Rect
          width={w}
          height={d}
          fill={color}
          stroke={OUTLINE}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />
      );
    case 'roundedRectangle':
      return (
        <Rect
          width={w}
          height={d}
          fill={color}
          cornerRadius={cornerRadiusMm ?? 0}
          stroke={OUTLINE}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />
      );
    case 'circle':
      return (
        <Ellipse
          x={w / 2}
          y={d / 2}
          radiusX={w / 2}
          radiusY={d / 2}
          fill={color}
          stroke={OUTLINE}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />
      );
    // semicircle / customPath: 이번 단계에서는 placeholder (반투명 + 대각선)
    default:
      return (
        <>
          <Rect width={w} height={d} fill={color} opacity={0.3} />
          <Line points={[0, 0, w, d]} stroke={color} strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[w, 0, 0, d]} stroke={color} strokeWidth={1} strokeScaleEnabled={false} />
          <Rect
            width={w}
            height={d}
            stroke={color}
            dash={[10, 6]}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
          />
        </>
      );
  }
}

/** 선택 핸들 화면 크기(px) — 배율과 무관하게 일정하게 보이도록 counter-scale */
const HANDLE_PX = 9;

interface FixtureNodeProps {
  placed: PlacedFixture;
  def: FixtureDef;
  selected: boolean;
  boothW: number;
  boothD: number;
  /** Stage 배율(px/mm). 선택 핸들을 화면상 일정 크기로 그리는 데 사용 */
  scale: number;
  onSelect: (id: string) => void;
  onMove: (id: string, xMm: number, yMm: number) => void;
}

/** 선택된 집기의 네 모서리 핸들 */
function SelectionHandles({
  widthMm,
  depthMm,
  scale,
  color,
}: {
  widthMm: number;
  depthMm: number;
  scale: number;
  color: string;
}) {
  const s = HANDLE_PX / scale; // mm
  const corners = [
    [0, 0],
    [widthMm, 0],
    [widthMm, depthMm],
    [0, depthMm],
  ];
  return (
    <>
      {corners.map(([cx, cy], i) => (
        <Rect
          key={i}
          x={cx - s / 2}
          y={cy - s / 2}
          width={s}
          height={s}
          fill="#ffffff"
          stroke={color}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
          listening={false}
        />
      ))}
    </>
  );
}

/**
 * 캔버스 위의 배치 집기 하나.
 * Group 의 x/y/rotation 은 mm·deg 이며, Stage 배율이 화면 변환을 담당하므로
 * 드래그 종료 시 node.x()/node.y() 가 곧 mm 좌표입니다.
 */
export default function FixtureNode({
  placed,
  def,
  selected,
  boothW,
  boothD,
  scale,
  onSelect,
  onMove,
}: FixtureNodeProps) {
  const oob = isFixtureOutOfBounds(placed, def, boothW, boothD);
  const showBorder = selected || oob;
  // 부스 밖이면 항상 빨간 테두리 유지, 그 외 선택 시 파란 테두리
  const borderColor = oob ? WARN_COLOR : SELECT_COLOR;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onMove(placed.id, node.x(), node.y());
  };

  return (
    <Group
      x={placed.xMm}
      y={placed.yMm}
      rotation={placed.rotationDeg}
      draggable
      onMouseDown={() => onSelect(placed.id)}
      onTouchStart={() => onSelect(placed.id)}
      onDragStart={() => onSelect(placed.id)}
      onDragEnd={handleDragEnd}
    >
      <ShapeBody def={def} />
      {showBorder && (
        <Rect
          width={def.widthMm}
          height={def.depthMm}
          stroke={borderColor}
          strokeWidth={selected ? 3 : 2}
          strokeScaleEnabled={false}
          dash={selected ? undefined : [10, 6]}
          shadowColor={borderColor}
          shadowBlur={selected ? 8 : 0}
          shadowOpacity={0.5}
          listening={false}
        />
      )}
      {selected && (
        <SelectionHandles
          widthMm={def.widthMm}
          depthMm={def.depthMm}
          scale={scale}
          color={borderColor}
        />
      )}
    </Group>
  );
}

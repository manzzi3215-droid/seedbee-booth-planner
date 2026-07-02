import { Group, Rect, Ellipse, Line, Path, Text } from 'react-konva';
import type Konva from 'konva';
import type { FixtureDef, PlacedFixture, PointMm } from '../../types';
import { isFixtureOutOfBounds } from './fixtureGeometry';
import { CUSTOM_PATH_VIEW } from '../fixtures/shapes';

const SELECT_COLOR = '#2563eb';
const WARN_COLOR = '#dc2626';
const OUTLINE = 'rgba(0,0,0,0.35)';
const NAME_PX = 12; // 집기명 화면 폰트 크기
const NAME_MIN_W_PX = 36; // 이 너비(px)보다 작으면 이름 숨김
const NAME_MIN_H_PX = 18;

/** placeholder(반투명 + 대각선) — 아직 실제 형태가 없는 경우 */
function ShapePlaceholder({ w, d, color }: { w: number; d: number; color: string }) {
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
    case 'customPath':
      if (def.svgPath) {
        return (
          <Path
            data={def.svgPath}
            scaleX={w / CUSTOM_PATH_VIEW}
            scaleY={d / CUSTOM_PATH_VIEW}
            fill={color}
            stroke={OUTLINE}
            strokeWidth={1}
            strokeScaleEnabled={false}
          />
        );
      }
      return <ShapePlaceholder w={w} d={d} color={color} />;
    // semicircle (및 path 없는 customPath): placeholder
    default:
      return <ShapePlaceholder w={w} d={d} color={color} />;
  }
}

/** 선택 핸들 화면 크기(px) — 배율과 무관하게 일정하게 보이도록 counter-scale */
const HANDLE_PX = 9;

interface FixtureNodeProps {
  placed: PlacedFixture;
  def: FixtureDef;
  selected: boolean;
  /** 부스 외곽 폴리곤(mm) — 부스 밖 판정용 */
  boothPolygon: PointMm[];
  /** Stage 배율(px/mm). 선택 핸들을 화면상 일정 크기로 그리는 데 사용 */
  scale: number;
  /** 집기명 표시 여부 */
  showName: boolean;
  onSelect: (id: string) => void;
  /** 드래그 중 위치 보정(스마트 스냅). 보정된 좌표(mm) 반환 */
  onDragMove: (id: string, xMm: number, yMm: number, shiftKey: boolean) => { xMm: number; yMm: number };
  /** 드래그 종료. shiftKey(스마트 스냅) 여부 전달 */
  onDragEnd: (id: string, xMm: number, yMm: number, shiftKey: boolean) => void;
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
  boothPolygon,
  scale,
  showName,
  onSelect,
  onDragMove,
  onDragEnd,
}: FixtureNodeProps) {
  const oob = isFixtureOutOfBounds(placed, def, boothPolygon);
  const showBorder = selected || oob;
  // 부스 밖이면 항상 빨간 테두리 유지, 그 외 선택 시 파란 테두리
  const borderColor = oob ? WARN_COLOR : SELECT_COLOR;

  // 집기명 표시: 화면상 충분히 클 때만
  const nameVisible =
    showName &&
    def.name.length > 0 &&
    def.widthMm * scale >= NAME_MIN_W_PX &&
    def.depthMm * scale >= NAME_MIN_H_PX;
  const nameFontMm = NAME_PX / scale;

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const shift = e.evt.shiftKey;
    const snapped = onDragMove(placed.id, node.x(), node.y(), shift);
    // 스마트 스냅으로 보정된 위치를 즉시 노드에 반영(자석 효과)
    node.position({ x: snapped.xMm, y: snapped.yMm });
  };

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(placed.id, node.x(), node.y(), e.evt.shiftKey);
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
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <ShapeBody def={def} />
      {nameVisible && (
        <Text
          text={def.name}
          width={def.widthMm}
          height={def.depthMm}
          align="center"
          verticalAlign="middle"
          wrap="none"
          ellipsis
          fontSize={nameFontMm}
          fontStyle={selected ? 'bold' : 'normal'}
          fill="#ffffff"
          stroke="rgba(0,0,0,0.7)"
          strokeWidth={(selected ? 2.4 : 1.6) / scale}
          fillAfterStrokeEnabled
          opacity={selected ? 1 : 0.9}
          listening={false}
          padding={2}
        />
      )}
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

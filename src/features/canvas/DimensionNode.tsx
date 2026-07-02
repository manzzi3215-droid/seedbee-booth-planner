import { Group, Arrow, Text, Rect } from 'react-konva';
import type Konva from 'konva';
import type { PlacedDimension } from '../../types';
import { dimensionDisplayLabel, DIMENSION_FONT_FAMILY } from '../dimensions/constants';

const SELECT_COLOR = '#2563eb';
const ARROW_LEN_PX = 22;
const ARROW_WID_PX = 16;
const DIM_FONT_PX = 15;
const HANDLE_PX = 9;
const HIT_PX = 18;

interface DimensionNodeProps {
  dim: PlacedDimension;
  selected: boolean;
  scale: number; // px/mm — 화면 고정 크기 요소 counter-scale
  onSelect: (id: string) => void;
  onMove: (id: string, dxMm: number, dyMm: number) => void;
}

/**
 * 치수선 노드: 선(양끝 화살표) + 중앙 라벨 + 선택 시 끝점 핸들.
 * 각도는 시작/끝점에서 자동 계산. 드래그는 전체 평행이동.
 * Group 은 x=0,y=0 고정, 내부는 절대 mm 좌표로 그린다.
 */
export default function DimensionNode({ dim, selected, scale, onSelect, onMove }: DimensionNodeProps) {
  const { startXMm: sx, startYMm: sy, endXMm: ex, endYMm: ey } = dim;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const dx = node.x();
    const dy = node.y();
    node.position({ x: 0, y: 0 });
    onMove(dim.id, dx, dy);
  };

  // 라벨은 항상 왼→오른쪽으로 읽히도록 두 점 순서 정규화
  let ax = sx, ay = sy, bx = ex, by = ey;
  let ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  if (ang > 90 || ang < -90) {
    [ax, bx] = [bx, ax];
    [ay, by] = [by, ay];
    ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  }
  const length = Math.hypot(bx - ax, by - ay);
  const fontMm = DIM_FONT_PX / scale;
  const handle = HANDLE_PX / scale;

  return (
    <Group
      x={0}
      y={0}
      draggable
      onMouseDown={() => onSelect(dim.id)}
      onTouchStart={() => onSelect(dim.id)}
      onDragStart={() => onSelect(dim.id)}
      onDragEnd={handleDragEnd}
    >
      <Arrow
        points={[sx, sy, ex, ey]}
        stroke={dim.color}
        fill={dim.color}
        strokeWidth={dim.lineWidthPx}
        strokeScaleEnabled={false}
        pointerAtBeginning={dim.showArrows}
        pointerAtEnding={dim.showArrows}
        pointerLength={ARROW_LEN_PX / scale}
        pointerWidth={ARROW_WID_PX / scale}
        hitStrokeWidth={HIT_PX / scale}
      />

      {length >= 1 && (
        <Text
          text={dimensionDisplayLabel(dim)}
          x={ax}
          y={ay}
          rotation={ang}
          width={length}
          align="center"
          offsetY={fontMm * 1.4}
          fontSize={fontMm}
          fontFamily={DIMENSION_FONT_FAMILY}
          fill={dim.textColor}
          listening={false}
        />
      )}

      {selected && (
        <>
          <Rect
            x={sx - handle / 2}
            y={sy - handle / 2}
            width={handle}
            height={handle}
            fill="#ffffff"
            stroke={SELECT_COLOR}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            listening={false}
          />
          <Rect
            x={ex - handle / 2}
            y={ey - handle / 2}
            width={handle}
            height={handle}
            fill="#ffffff"
            stroke={SELECT_COLOR}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            listening={false}
          />
        </>
      )}
    </Group>
  );
}

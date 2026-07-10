import { useMemo } from 'react';
import { Group, Rect, Ellipse, Line, Path, Text, Circle } from 'react-konva';
import Konva from 'konva';
import type { FaceMapping, FixtureDef, PlacedFixture, PointMm } from '../../types';
import { isFixtureOutOfBounds } from './fixtureGeometry';
import { CUSTOM_PATH_VIEW } from '../fixtures/shapes';
import { fillColor } from '../colors/palette';
import DesignTextureNode from '../design/DesignTextureNode';

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
  const { shape, widthMm: w, depthMm: d, cornerRadiusMm } = def;
  const color = fillColor(def.color, def.opacity); // opacity 반영(rgba)

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
/** 회전 핸들 화면 크기(px) 및 집기 위쪽 거리(px) — v1.0.8 */
const ROTATE_HANDLE_PX = 11;
const ROTATE_HANDLE_GAP_PX = 26;
const ROTATE_COLOR = '#2563eb';

/**
 * 집기명 라벨 (v1.0.8) — 검정 라운드 배경 + 흰 글자.
 * 텍스트 길이에 맞춰 배경이 자동 크기 조정되며, 집기 중앙에 배치됩니다.
 * 집기와 함께 회전(Group 회전 상속)하지만 배경 덕분에 어느 배경 위에서도 읽힙니다.
 */
function FixtureName({
  name,
  widthMm,
  fontMm,
  selected,
}: {
  name: string;
  widthMm: number;
  fontMm: number;
  selected: boolean;
}) {
  const fontStyle = selected ? 'bold' : 'normal';
  const size = useMemo(() => {
    const t = new Konva.Text({ text: name, fontSize: fontMm, fontStyle });
    return { w: t.width(), h: t.height() };
  }, [name, fontMm, fontStyle]);

  const padX = fontMm * 0.4;
  const padY = fontMm * 0.22;
  const bgW = size.w + padX * 2;
  const bgH = size.h + padY * 2;
  const cx = widthMm / 2;
  // 집기명 = 집기 "위쪽"(상단 바깥). 라벨 하단이 top edge 위 gap 만큼 (v1.1.8, #6)
  const gap = fontMm * 0.45;
  const bgY = -bgH - gap;

  return (
    <Group listening={false}>
      <Rect
        x={cx - bgW / 2}
        y={bgY}
        width={bgW}
        height={bgH}
        fill="rgba(0,0,0,0.72)"
        cornerRadius={fontMm * 0.28}
      />
      <Text
        text={name}
        x={cx - size.w / 2}
        y={bgY + padY}
        width={size.w}
        height={size.h}
        align="center"
        verticalAlign="middle"
        wrap="none"
        fontSize={fontMm}
        fontStyle={fontStyle}
        fill="#ffffff"
      />
    </Group>
  );
}

/**
 * 집기 사이즈 라벨 (v1.1.8, #6) — 집기 "아래쪽"(하단 바깥)에 파란 통일 치수 라벨.
 * 가로×세로(mm, 바운딩 박스). 배율 무관 고정 크기.
 */
const DIM_LABEL_BG = '#2563eb';
function FixtureSize({
  widthMm,
  depthMm,
  fontMm,
}: {
  widthMm: number;
  depthMm: number;
  fontMm: number;
}) {
  const text = `${Math.round(widthMm)}×${Math.round(depthMm)}`;
  const size = useMemo(() => {
    const t = new Konva.Text({ text, fontSize: fontMm, fontStyle: 'bold' });
    return { w: t.width(), h: t.height() };
  }, [text, fontMm]);
  const padX = fontMm * 0.5;
  const padY = fontMm * 0.28;
  const bgW = size.w + padX * 2;
  const bgH = size.h + padY * 2;
  const cx = widthMm / 2;
  const gap = fontMm * 0.45;
  const bgY = depthMm + gap; // bottom edge 아래

  return (
    <Group listening={false}>
      <Rect
        x={cx - bgW / 2}
        y={bgY}
        width={bgW}
        height={bgH}
        fill={DIM_LABEL_BG}
        cornerRadius={fontMm * 0.32}
        shadowColor="#000000"
        shadowBlur={fontMm * 0.25}
        shadowOpacity={0.25}
      />
      <Text
        text={text}
        x={cx - size.w / 2}
        y={bgY + padY}
        width={size.w}
        height={size.h}
        align="center"
        verticalAlign="middle"
        wrap="none"
        fontSize={fontMm}
        fontStyle="bold"
        fill="#ffffff"
      />
    </Group>
  );
}

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
  /** 집기 사이즈(치수) 라벨 표시 여부 (v1.1.8, #6) */
  showSize?: boolean;
  /** 디자인 텍스처(2D) — 평면도 면 매핑 + 로드된 이미지 */
  designMapping?: FaceMapping | null;
  designImage?: HTMLImageElement;
  /** additive=true 면 다중 선택 토글 (Ctrl/Shift/Cmd) — v0.9.0 */
  onSelect: (id: string, additive: boolean) => void;
  /** 드래그 시작 — 그룹 이동 기준점 스냅샷용 (v1.0.8) */
  onDragStartFixture?: (id: string) => void;
  /** 드래그 중 위치 보정(스마트 스냅). 보정된 좌표(mm) 반환 */
  onDragMove: (id: string, xMm: number, yMm: number, shiftKey: boolean) => { xMm: number; yMm: number };
  /** 드래그 종료. shiftKey(스마트 스냅) 여부 전달 */
  onDragEnd: (id: string, xMm: number, yMm: number, shiftKey: boolean) => void;
  /** 마우스 회전 핸들 표시 여부 (단일 선택일 때만) — v1.0.8 */
  showRotateHandle?: boolean;
  /** 회전 콜백(절대 각도) — 마우스 회전 핸들 (v1.0.8) */
  onRotate?: (id: string, deg: number) => void;
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
  showSize,
  designMapping,
  designImage,
  onSelect,
  onDragStartFixture,
  onDragMove,
  onDragEnd,
  showRotateHandle,
  onRotate,
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

  // 사이즈 라벨 표시: 치수 토글 ON + 화면상 충분히 클 때만 (v1.1.8)
  const sizeVisible =
    !!showSize &&
    def.widthMm * scale >= NAME_MIN_W_PX &&
    def.depthMm * scale >= NAME_MIN_H_PX;
  const sizeFontMm = 11 / scale;

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

  // Ctrl/Cmd/Shift 클릭 = 다중 선택 토글
  const isAdditive = (evt: MouseEvent | TouchEvent) =>
    'ctrlKey' in evt ? evt.ctrlKey || evt.metaKey || evt.shiftKey : false;

  // 회전 핸들 (v1.0.8) — Group 로컬 좌표에서 각도 계산. Shift = 15° 스냅.
  const handleGapMm = ROTATE_HANDLE_GAP_PX / scale;
  const handleRestX = def.widthMm / 2;
  const handleRestY = -handleGapMm;
  const handleRotateMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const lx = node.x();
    const ly = node.y();
    const phi = Math.atan2(ly - def.depthMm / 2, lx - def.widthMm / 2);
    let next = placed.rotationDeg + (phi * 180) / Math.PI + 90;
    if (e.evt.shiftKey) next = Math.round(next / 15) * 15;
    onRotate?.(placed.id, next);
    node.position({ x: handleRestX, y: handleRestY }); // 핸들은 항상 정위치로 복귀
  };

  return (
    <Group
      x={placed.xMm}
      y={placed.yMm}
      rotation={placed.rotationDeg}
      draggable
      onMouseDown={(e) => onSelect(placed.id, isAdditive(e.evt))}
      onTouchStart={() => onSelect(placed.id, false)}
      onDragStart={() => {
        onDragStartFixture?.(placed.id);
        onSelect(placed.id, false);
      }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <ShapeBody def={def} />
      {designMapping && designImage && (
        <DesignTextureNode image={designImage} w={def.widthMm} d={def.depthMm} mapping={designMapping} />
      )}
      {nameVisible && (
        <FixtureName
          name={def.name}
          widthMm={def.widthMm}
          fontMm={nameFontMm}
          selected={selected}
        />
      )}
      {sizeVisible && (
        <FixtureSize widthMm={def.widthMm} depthMm={def.depthMm} fontMm={sizeFontMm} />
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
      {showRotateHandle && (
        <>
          {/* 집기 상단 중앙 → 회전 핸들 연결선 */}
          <Line
            points={[def.widthMm / 2, 0, handleRestX, handleRestY]}
            stroke={ROTATE_COLOR}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            listening={false}
          />
          <Circle
            x={handleRestX}
            y={handleRestY}
            radius={ROTATE_HANDLE_PX / scale}
            fill="#ffffff"
            stroke={ROTATE_COLOR}
            strokeWidth={2}
            strokeScaleEnabled={false}
            draggable
            onMouseDown={(e) => {
              e.cancelBubble = true;
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
            }}
            onDragMove={handleRotateMove}
            onDragEnd={(e) => {
              e.cancelBubble = true;
              e.target.position({ x: handleRestX, y: handleRestY });
            }}
          />
        </>
      )}
    </Group>
  );
}

import { useEffect, useState } from 'react';
import { Stage, Layer, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import FitScreenRoundedIcon from '@mui/icons-material/FitScreenRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import type { BoothConfig, FixtureDef, PlacedFixture } from '../../types';
import { useContainerSize } from './useContainerSize';
import { computeFit, zoomAtPoint, pxToMm, type Viewport } from './coords';
import FixtureNode from './FixtureNode';
import {
  DEFAULT_GRID_SIZE_MM,
  ZOOM_STEP,
  WALL_STROKE_PX,
  GRID_STROKE_PX,
  DIM_LABEL_PX,
  DIM_LINE_PX,
  CANVAS_COLORS,
  getWallEdges,
} from './constants';

interface BoothCanvasProps {
  booth: BoothConfig;
  placed: PlacedFixture[];
  fixturesById: Map<string, FixtureDef>;
  selectedId: string | null;
  gridSizeMm?: number;
  onSelect: (id: string | null) => void;
  onMove: (id: string, xMm: number, yMm: number) => void;
}

/**
 * 부스 2D 평면도 캔버스 (React Konva).
 *
 * - 모든 도형은 mm 좌표로 그리고, Stage 의 scale/position 이 화면 변환을 담당합니다.
 * - 선(그리드/벽체/치수선)은 strokeScaleEnabled=false 로 배율과 무관하게 일정한 두께.
 * - 텍스트는 fontSize 를 1/scale 로 counter-scale 하여 화면상 크기를 일정하게 유지.
 * - 배치된 집기는 별도의 상호작용 Layer 에 렌더링합니다(드래그/선택).
 */
export default function BoothCanvas({
  booth,
  placed,
  fixturesById,
  selectedId,
  gridSizeMm = DEFAULT_GRID_SIZE_MM,
  onSelect,
  onMove,
}: BoothCanvasProps) {
  const { ref, size } = useContainerSize<HTMLDivElement>();
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });

  const { widthMm, depthMm } = booth;
  const edges = getWallEdges(booth.openSide);

  const fit = () =>
    setViewport(computeFit(size.width, size.height, widthMm, depthMm));

  // 컨테이너 크기 또는 부스 치수가 바뀌면 화면 맞춤
  useEffect(() => {
    if (size.width > 0 && size.height > 0) {
      setViewport(computeFit(size.width, size.height, widthMm, depthMm));
    }
  }, [size.width, size.height, widthMm, depthMm]);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    setViewport((vp) => zoomAtPoint(vp, pointer, factor));
  };

  const zoomByButton = (factor: number) => {
    const center = { x: size.width / 2, y: size.height / 2 };
    setViewport((vp) => zoomAtPoint(vp, center, factor));
  };

  // 빈 공간(Stage 자체) 클릭 시 선택 해제
  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) {
      onSelect(null);
    }
  };

  const ready = size.width > 0 && size.height > 0 && widthMm > 0 && depthMm > 0;

  return (
    <Box
      ref={ref}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        bgcolor: CANVAS_COLORS.background,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {ready && (
        <Stage
          width={size.width}
          height={size.height}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          x={viewport.x}
          y={viewport.y}
          onWheel={handleWheel}
          onMouseDown={handleStageMouseDown}
        >
          {/* 배경 레이어: 바닥/그리드/벽체/치수 (이벤트 비수신) */}
          <Layer listening={false}>
            <Rect
              x={0}
              y={0}
              width={widthMm}
              height={depthMm}
              fill={CANVAS_COLORS.floorFill}
            />
            <GridLines widthMm={widthMm} depthMm={depthMm} gridSizeMm={gridSizeMm} />
            <Walls widthMm={widthMm} depthMm={depthMm} edges={edges} />
            <Dimensions widthMm={widthMm} depthMm={depthMm} scale={viewport.scale} />
          </Layer>

          {/* 집기 레이어: 드래그/선택 상호작용 */}
          <Layer>
            {placed.map((p) => {
              const def = fixturesById.get(p.fixtureDefId);
              if (!def) return null;
              return (
                <FixtureNode
                  key={p.id}
                  placed={p}
                  def={def}
                  selected={p.id === selectedId}
                  boothW={widthMm}
                  boothD={depthMm}
                  scale={viewport.scale}
                  onSelect={onSelect}
                  onMove={onMove}
                />
              );
            })}
          </Layer>
        </Stage>
      )}

      {/* 오버레이 툴바 */}
      <Paper
        elevation={2}
        sx={{ position: 'absolute', top: 12, right: 12, p: 0.5 }}
      >
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <Tooltip title="축소">
            <IconButton size="small" onClick={() => zoomByButton(1 / ZOOM_STEP)}>
              <RemoveRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="확대">
            <IconButton size="small" onClick={() => zoomByButton(ZOOM_STEP)}>
              <AddRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            size="small"
            startIcon={<FitScreenRoundedIcon />}
            onClick={fit}
            sx={{ ml: 0.5 }}
          >
            화면 맞춤
          </Button>
        </Stack>
      </Paper>

      {/* 좌하단 배율 표시 */}
      <Typography
        variant="caption"
        sx={{
          position: 'absolute',
          left: 12,
          bottom: 8,
          color: 'text.secondary',
          bgcolor: 'rgba(255,255,255,0.7)',
          px: 1,
          borderRadius: 1,
        }}
      >
        1mm ≈ {viewport.scale.toFixed(3)}px · 그리드 {gridSizeMm}mm
      </Typography>
    </Box>
  );
}

/** 연한 내부 그리드 */
function GridLines({
  widthMm,
  depthMm,
  gridSizeMm,
}: {
  widthMm: number;
  depthMm: number;
  gridSizeMm: number;
}) {
  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= widthMm + 0.5; x += gridSizeMm) {
    const xi = Math.min(x, widthMm);
    lines.push(
      <Line
        key={`v-${x}`}
        points={[xi, 0, xi, depthMm]}
        stroke={CANVAS_COLORS.grid}
        strokeWidth={GRID_STROKE_PX}
        strokeScaleEnabled={false}
      />,
    );
  }
  for (let y = 0; y <= depthMm + 0.5; y += gridSizeMm) {
    const yi = Math.min(y, depthMm);
    lines.push(
      <Line
        key={`h-${y}`}
        points={[0, yi, widthMm, yi]}
        stroke={CANVAS_COLORS.grid}
        strokeWidth={GRID_STROKE_PX}
        strokeScaleEnabled={false}
      />,
    );
  }
  return <>{lines}</>;
}

/** 닫힌 변에만 두꺼운 회색 벽체 렌더링 (열린 면은 라인 없음) */
function Walls({
  widthMm,
  depthMm,
  edges,
}: {
  widthMm: number;
  depthMm: number;
  edges: ReturnType<typeof getWallEdges>;
}) {
  const wall = (key: string, points: number[]) => (
    <Line
      key={key}
      points={points}
      stroke={CANVAS_COLORS.wall}
      strokeWidth={WALL_STROKE_PX}
      strokeScaleEnabled={false}
      lineCap="square"
    />
  );
  return (
    <>
      {edges.top && wall('wall-top', [0, 0, widthMm, 0])}
      {edges.right && wall('wall-right', [widthMm, 0, widthMm, depthMm])}
      {edges.bottom && wall('wall-bottom', [0, depthMm, widthMm, depthMm])}
      {edges.left && wall('wall-left', [0, 0, 0, depthMm])}
    </>
  );
}

/** 가로/세로 치수(mm) 표시 */
function Dimensions({
  widthMm,
  depthMm,
  scale,
}: {
  widthMm: number;
  depthMm: number;
  scale: number;
}) {
  const vp: Viewport = { scale, x: 0, y: 0 };
  const gap = pxToMm(18, vp); // 부스 외곽에서 치수선까지 거리
  const tick = pxToMm(5, vp);
  const font = pxToMm(DIM_LABEL_PX, vp);

  const lineStyle = {
    stroke: CANVAS_COLORS.dimLine,
    strokeWidth: DIM_LINE_PX,
    strokeScaleEnabled: false,
  } as const;

  return (
    <>
      {/* 가로 치수 (아래쪽) */}
      <Line points={[0, depthMm + gap, widthMm, depthMm + gap]} {...lineStyle} />
      <Line points={[0, depthMm + gap - tick, 0, depthMm + gap + tick]} {...lineStyle} />
      <Line
        points={[widthMm, depthMm + gap - tick, widthMm, depthMm + gap + tick]}
        {...lineStyle}
      />
      <Text
        text={`${widthMm} mm`}
        x={0}
        y={depthMm + gap + tick}
        width={widthMm}
        align="center"
        fontSize={font}
        fill={CANVAS_COLORS.dimText}
      />

      {/* 세로 치수 (왼쪽, 회전) */}
      <Line points={[-gap, 0, -gap, depthMm]} {...lineStyle} />
      <Line points={[-gap - tick, 0, -gap + tick, 0]} {...lineStyle} />
      <Line points={[-gap - tick, depthMm, -gap + tick, depthMm]} {...lineStyle} />
      <Text
        text={`${depthMm} mm`}
        x={-gap - tick}
        y={depthMm}
        width={depthMm}
        align="center"
        rotation={-90}
        offsetY={font + pxToMm(2, vp)}
        fontSize={font}
        fill={CANVAS_COLORS.dimText}
      />
    </>
  );
}

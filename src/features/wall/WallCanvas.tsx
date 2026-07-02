import { useEffect, useState } from 'react';
import { Stage, Layer, Line, Rect, Text, Transformer } from 'react-konva';
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
import type { PlacedDimension, PlacedImage, PlacedText } from '../../types';
import { useContainerSize } from '../canvas/useContainerSize';
import { computeFit, zoomAtPoint, pxToMm, type Viewport } from '../canvas/coords';
import TextNode from '../canvas/TextNode';
import DimensionNode from '../canvas/DimensionNode';
import ImageNode from '../canvas/ImageNode';
import { useImageMap } from '../canvas/useDataUrlImage';
import { useImageTransformer } from '../canvas/useImageTransformer';
import {
  DEFAULT_GRID_SIZE_MM,
  ZOOM_STEP,
  GRID_STROKE_PX,
  WALL_STROKE_PX,
  DIM_LABEL_PX,
  DIM_LINE_PX,
  CANVAS_COLORS,
} from '../canvas/constants';

interface WallCanvasProps {
  /** 벽면 가로 길이(mm) */
  wallLengthMm: number;
  /** 벽면 높이(mm) = boothConfig.heightMm */
  heightMm: number;
  gridSizeMm?: number;
  // 벽면 요소 (편집)
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  images: PlacedImage[];
  selectedTextId: string | null;
  selectedDimensionId: string | null;
  selectedImageId: string | null;
  onSelectText: (id: string) => void;
  onMoveText: (id: string, xMm: number, yMm: number) => void;
  onSelectDimension: (id: string) => void;
  onMoveDimension: (id: string, dxMm: number, dyMm: number) => void;
  onSelectImage: (id: string) => void;
  onChangeImage: (id: string, patch: Partial<PlacedImage>) => void;
  onDeselect: () => void;
}

const WALL_FILL = '#e9edf2'; // 연한 회색 벽면

/**
 * 벽면 전개도 캔버스 (읽기 전용).
 * 가로 = 벽 길이(mm), 세로 = 부스 높이(mm). 그리드/외곽선/치수만 표시.
 * (벽 부착물 배치는 다음 단계)
 */
export default function WallCanvas({
  wallLengthMm,
  heightMm,
  gridSizeMm = DEFAULT_GRID_SIZE_MM,
  texts,
  dimensions,
  images,
  selectedTextId,
  selectedDimensionId,
  selectedImageId,
  onSelectText,
  onMoveText,
  onSelectDimension,
  onMoveDimension,
  onSelectImage,
  onChangeImage,
  onDeselect,
}: WallCanvasProps) {
  const { ref, size } = useContainerSize<HTMLDivElement>();
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const imageMap = useImageMap(images.map((i) => i.srcDataUrl));
  const { transformerRef, register } = useImageTransformer(selectedImageId);

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.target === e.target.getStage()) onDeselect();
  };

  const fit = () => setViewport(computeFit(size.width, size.height, wallLengthMm, heightMm));

  useEffect(() => {
    if (size.width > 0 && size.height > 0) {
      setViewport(computeFit(size.width, size.height, wallLengthMm, heightMm));
    }
  }, [size.width, size.height, wallLengthMm, heightMm]);

  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = e.target.getStage()?.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;
    setViewport((vp) => zoomAtPoint(vp, pointer, factor));
  };

  const zoomByButton = (factor: number) =>
    setViewport((vp) => zoomAtPoint(vp, { x: size.width / 2, y: size.height / 2 }, factor));

  const ready = size.width > 0 && size.height > 0 && wallLengthMm > 0 && heightMm > 0;

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
          <Layer listening={false}>
            {/* 벽면 */}
            <Rect
              x={0}
              y={0}
              width={wallLengthMm}
              height={heightMm}
              fill={WALL_FILL}
              stroke={CANVAS_COLORS.wall}
              strokeWidth={WALL_STROKE_PX}
              strokeScaleEnabled={false}
            />
            <WallGrid wallLengthMm={wallLengthMm} heightMm={heightMm} gridSizeMm={gridSizeMm} />
            <WallDimensions wallLengthMm={wallLengthMm} heightMm={heightMm} scale={viewport.scale} />
          </Layer>

          {/* 벽면 요소 (이미지/텍스트/치수선) */}
          <Layer>
            {images.map((img) => (
              <ImageNode
                key={img.id}
                image={img}
                imageEl={imageMap.get(img.srcDataUrl)}
                register={register(img.id)}
                onSelect={onSelectImage}
                onChange={onChangeImage}
              />
            ))}
            {selectedImageId && (
              <Transformer
                ref={transformerRef}
                rotateEnabled
                keepRatio={false}
                anchorSize={14 / viewport.scale}
                anchorStrokeWidth={1.5 / viewport.scale}
                borderStrokeWidth={1.5 / viewport.scale}
                rotateAnchorOffset={26 / viewport.scale}
                boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
              />
            )}
            {texts.map((t) => (
              <TextNode
                key={t.id}
                text={t}
                selected={t.id === selectedTextId}
                onSelect={onSelectText}
                onMove={onMoveText}
              />
            ))}
            {dimensions.map((d) => (
              <DimensionNode
                key={d.id}
                dim={d}
                selected={d.id === selectedDimensionId}
                scale={viewport.scale}
                onSelect={onSelectDimension}
                onMove={onMoveDimension}
              />
            ))}
          </Layer>
        </Stage>
      )}

      <Paper elevation={2} sx={{ position: 'absolute', top: 12, right: 12, p: 0.5 }}>
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
          <Button size="small" startIcon={<FitScreenRoundedIcon />} onClick={fit} sx={{ ml: 0.5 }}>
            화면 맞춤
          </Button>
        </Stack>
      </Paper>

      <Typography
        variant="caption"
        sx={{ position: 'absolute', left: 12, bottom: 8, color: 'text.secondary', bgcolor: 'rgba(255,255,255,0.7)', px: 1, borderRadius: 1 }}
      >
        1mm ≈ {viewport.scale.toFixed(3)}px · 그리드 {gridSizeMm}mm
      </Typography>
    </Box>
  );
}

function WallGrid({ wallLengthMm, heightMm, gridSizeMm }: { wallLengthMm: number; heightMm: number; gridSizeMm: number }) {
  const lines: React.ReactNode[] = [];
  for (let x = 0; x <= wallLengthMm + 0.5; x += gridSizeMm) {
    const xi = Math.min(x, wallLengthMm);
    lines.push(<Line key={`v-${x}`} points={[xi, 0, xi, heightMm]} stroke={CANVAS_COLORS.grid} strokeWidth={GRID_STROKE_PX} strokeScaleEnabled={false} />);
  }
  for (let y = 0; y <= heightMm + 0.5; y += gridSizeMm) {
    const yi = Math.min(y, heightMm);
    lines.push(<Line key={`h-${y}`} points={[0, yi, wallLengthMm, yi]} stroke={CANVAS_COLORS.grid} strokeWidth={GRID_STROKE_PX} strokeScaleEnabled={false} />);
  }
  return <>{lines}</>;
}

function WallDimensions({ wallLengthMm, heightMm, scale }: { wallLengthMm: number; heightMm: number; scale: number }) {
  const vp: Viewport = { scale, x: 0, y: 0 };
  const gap = pxToMm(18, vp);
  const tick = pxToMm(5, vp);
  const font = pxToMm(DIM_LABEL_PX, vp);
  const lineStyle = { stroke: CANVAS_COLORS.dimLine, strokeWidth: DIM_LINE_PX, strokeScaleEnabled: false } as const;

  return (
    <>
      {/* 가로(벽 길이) 치수 — 아래쪽 */}
      <Line points={[0, heightMm + gap, wallLengthMm, heightMm + gap]} {...lineStyle} />
      <Line points={[0, heightMm + gap - tick, 0, heightMm + gap + tick]} {...lineStyle} />
      <Line points={[wallLengthMm, heightMm + gap - tick, wallLengthMm, heightMm + gap + tick]} {...lineStyle} />
      <Text text={`${wallLengthMm} mm`} x={0} y={heightMm + gap + tick} width={wallLengthMm} align="center" fontSize={font} fill={CANVAS_COLORS.dimText} />

      {/* 세로(높이) 치수 — 왼쪽 */}
      <Line points={[-gap, 0, -gap, heightMm]} {...lineStyle} />
      <Line points={[-gap - tick, 0, -gap + tick, 0]} {...lineStyle} />
      <Line points={[-gap - tick, heightMm, -gap + tick, heightMm]} {...lineStyle} />
      <Text text={`${heightMm} mm`} x={-gap - tick} y={heightMm} width={heightMm} align="center" rotation={-90} offsetY={font + pxToMm(2, vp)} fontSize={font} fill={CANVAS_COLORS.dimText} />
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Line, Text, Group, Transformer, Image as KonvaImage } from 'react-konva';
import Konva from 'konva';
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
import type {
  BoothConfig,
  DesignAsset,
  FixtureDef,
  PlacedDimension,
  PlacedFixture,
  PlacedImage,
  PlacedText,
  PointMm,
  SvgDocument,
} from '../../types';
import { planFaceMapping, assetById } from '../design/mapping';
import SvgHighlightOverlay from '../svg/SvgRenderer';
import { useContainerSize } from './useContainerSize';
import { computeFit, zoomAtPoint, pxToMm, snapMmToGrid, type Viewport } from './coords';
import ShapeEditor from './ShapeEditor';
import FixtureNode from './FixtureNode';
import TextNode from './TextNode';
import DimensionNode from './DimensionNode';
import ImageNode from './ImageNode';
import { useImageMap } from './useDataUrlImage';
import { useImageTransformer } from './useImageTransformer';
import {
  getBoothShape,
  getBoothPolygon,
  flattenPolygon,
  type BoothBounds,
} from './boothGeometry';
import { computeSmartSnap, type SnapGuide, type SnapTargetFixture } from './smartSnap';
import {
  DEFAULT_GRID_SIZE_MM,
  ZOOM_STEP,
  WALL_STROKE_PX,
  GRID_STROKE_PX,
  GUIDE_STROKE_PX,
  SNAP_THRESHOLD_MM,
  DIM_LABEL_PX,
  DIM_LINE_PX,
  CANVAS_COLORS,
  getWallEdges,
} from './constants';

interface BoothCanvasProps {
  booth: BoothConfig;
  placed: PlacedFixture[];
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  images: PlacedImage[];
  backgrounds: PlacedImage[];
  fixturesById: Map<string, FixtureDef>;
  showFixtureNames: boolean;
  /** 디자인 에셋 (텍스처 참조) */
  designAssets?: DesignAsset[];
  selectedFixtureId: string | null;
  /** 다중 선택된 집기 id (v0.9.0) — 있으면 이 목록으로 하이라이트 */
  selectedFixtureIds?: string[];
  selectedTextId: string | null;
  selectedDimensionId: string | null;
  selectedImageId: string | null;
  selectedBackgroundId: string | null;
  /** 선택된 SVG 문서 (구조 검사용, 있으면 하이라이트 오버레이) */
  selectedSvgDoc?: SvgDocument | null;
  highlightedSvgElementId?: string | null;
  gridSizeMm?: number;
  /** 평면도 보기 회전(deg). 보기 전용 변환 — 실제 좌표 불변 */
  viewRotationDeg?: number;
  /** 편집 가능 여부(false 면 드래그/선택 비활성 — 읽기전용/회전 상태) */
  interactive?: boolean;
  /** 부스 외곽 편집 모드 (v0.8.6) */
  shapeEditMode?: boolean;
  /** 외곽 폴리곤(mm) 변경 커밋 */
  onBoothShapeChange?: (points: PointMm[]) => void;
  /** 외곽 편집 종료(ESC) */
  onExitShapeEdit?: () => void;
  onSelect: (id: string | null, additive?: boolean) => void;
  onMove: (id: string, xMm: number, yMm: number, snapToGrid?: boolean) => void;
  onSelectText: (id: string | null) => void;
  onMoveText: (id: string, xMm: number, yMm: number) => void;
  onSelectDimension: (id: string | null) => void;
  onMoveDimension: (id: string, dxMm: number, dyMm: number) => void;
  onSelectImage: (id: string | null) => void;
  onChangeImage: (id: string, patch: Partial<PlacedImage>) => void;
  onSelectBackground: (id: string | null) => void;
  onChangeBackground: (id: string, patch: Partial<PlacedImage>) => void;
}

/**
 * 부스 2D 평면도 캔버스 (React Konva).
 *
 * - 부스는 항상 폴리곤으로 다룬다(사각형 = 4꼭짓점). rectangle/polygon 공통 처리.
 * - 모든 도형은 mm 좌표로 그리고, Stage 의 scale/position 이 화면 변환을 담당.
 * - 선은 strokeScaleEnabled=false 로 배율과 무관하게 일정한 두께.
 * - 텍스트는 fontSize 를 1/scale 로 counter-scale.
 */
export default function BoothCanvas({
  booth,
  placed,
  texts,
  dimensions,
  images,
  backgrounds,
  fixturesById,
  showFixtureNames,
  designAssets,
  selectedFixtureId,
  selectedFixtureIds,
  selectedTextId,
  selectedDimensionId,
  selectedImageId,
  selectedBackgroundId,
  selectedSvgDoc,
  highlightedSvgElementId,
  gridSizeMm = DEFAULT_GRID_SIZE_MM,
  viewRotationDeg = 0,
  interactive = true,
  shapeEditMode = false,
  onBoothShapeChange,
  onExitShapeEdit,
  onSelect,
  onMove,
  onSelectText,
  onMoveText,
  onSelectDimension,
  onMoveDimension,
  onSelectImage,
  onChangeImage,
  onSelectBackground,
  onChangeBackground,
}: BoothCanvasProps) {
  const { ref, size } = useContainerSize<HTMLDivElement>();
  const [viewport, setViewport] = useState<Viewport>({ scale: 1, x: 0, y: 0 });
  const guideLayerRef = useRef<Konva.Layer>(null);
  const imageMap = useImageMap([
    ...backgrounds.map((i) => i.srcDataUrl),
    ...images.map((i) => i.srcDataUrl),
    ...(designAssets ?? []).map((a) => a.url),
  ]);
  // 이미지 또는 배경 중 선택된 것에 Transformer 부착
  const { transformerRef, register } = useImageTransformer(selectedImageId ?? selectedBackgroundId);

  // --- 부스 외곽 편집 상태 (v0.8.6) ---
  const shapeLayerRef = useRef<Konva.Layer>(null);
  const [editPoints, setEditPoints] = useState<PointMm[] | null>(null);
  const editPointsRef = useRef<PointMm[] | null>(null);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  const [hoverEdge, setHoverEdge] = useState<number | null>(null);
  const dragRef = useRef<{ type: 'vertex' | 'edge'; index: number; last: { x: number; y: number } } | null>(null);

  // 편집 모드 진입 시 현재 폴리곤 복제, 종료 시 정리
  useEffect(() => {
    if (shapeEditMode) {
      setEditPoints(getBoothPolygon(booth).map((p) => ({ ...p })));
    } else {
      setEditPoints(null);
      setSelectedVertex(null);
      setHoverEdge(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeEditMode]);
  editPointsRef.current = editPoints;

  const activePolygon = shapeEditMode && editPoints ? editPoints : getBoothPolygon(booth);
  const polygon = activePolygon;
  const bounds = boundsFromPoints(activePolygon);
  const isPolygon = getBoothShape(booth) === 'polygon' || (shapeEditMode && !!editPoints);
  const edges = getWallEdges(booth.openSide);

  // 스냅 가이드라인은 전용 레이어에 명령형으로 그린다(드래그 중 re-render 방지).
  const drawGuides = (guides: SnapGuide[]) => {
    const layer = guideLayerRef.current;
    if (!layer) return;
    layer.destroyChildren();
    const ext = Math.max(bounds.widthMm, bounds.depthMm) * 0.04;
    for (const g of guides) {
      const points =
        g.axis === 'x'
          ? [g.valueMm, bounds.minY - ext, g.valueMm, bounds.maxY + ext]
          : [bounds.minX - ext, g.valueMm, bounds.maxX + ext, g.valueMm];
      layer.add(
        new Konva.Line({
          points,
          stroke: CANVAS_COLORS.guide,
          strokeWidth: GUIDE_STROKE_PX,
          strokeScaleEnabled: false,
          dash: [8, 6],
          listening: false,
        }),
      );
    }
    layer.batchDraw();
  };

  // 드래그 중: Shift 면 스마트 스냅, 아니면 자유 이동
  const handleFixtureDragMove = (
    id: string,
    rawX: number,
    rawY: number,
    shift: boolean,
  ): { xMm: number; yMm: number } => {
    if (!shift) {
      drawGuides([]);
      return { xMm: rawX, yMm: rawY };
    }
    const dragged = placed.find((p) => p.id === id);
    const def = dragged && fixturesById.get(dragged.fixtureDefId);
    if (!dragged || !def) return { xMm: rawX, yMm: rawY };

    const others: SnapTargetFixture[] = placed
      .filter((p) => p.id !== id)
      .map((p) => ({ placed: p, def: fixturesById.get(p.fixtureDefId) }))
      .filter((o): o is SnapTargetFixture => o.def != null);

    const res = computeSmartSnap(
      { ...dragged, xMm: rawX, yMm: rawY },
      def,
      others,
      bounds,
      SNAP_THRESHOLD_MM,
    );
    drawGuides(res.guides);
    return { xMm: res.xMm, yMm: res.yMm };
  };

  // 드래그 종료: 가이드 제거 + 저장(Shift 스냅이면 그리드 스냅 생략)
  const handleFixtureDragEnd = (
    id: string,
    xMm: number,
    yMm: number,
    shift: boolean,
  ) => {
    drawGuides([]);
    onMove(id, xMm, yMm, !shift);
  };

  // 보기 회전 중심(부스 중심, mm) + 레이어 회전 변환
  const centerX = bounds.minX + bounds.widthMm / 2;
  const centerY = bounds.minY + bounds.depthMm / 2;
  const layerRot =
    viewRotationDeg % 360 !== 0
      ? { rotation: viewRotationDeg, offsetX: centerX, offsetY: centerY, x: centerX, y: centerY }
      : {};
  // 회전을 반영한 화면 맞춤 범위(회전된 바운딩 박스)
  const fb = rotatedFitBounds(bounds, viewRotationDeg);

  const fit = () =>
    setViewport(computeFit(size.width, size.height, fb.widthMm, fb.depthMm, fb.minX, fb.minY));

  // 컨테이너 크기 / 부스 / 회전이 바뀌면 화면 맞춤
  useEffect(() => {
    if (size.width > 0 && size.height > 0) {
      setViewport(computeFit(size.width, size.height, fb.widthMm, fb.depthMm, fb.minX, fb.minY));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size.width, size.height, bounds.widthMm, bounds.depthMm, bounds.minX, bounds.minY, viewRotationDeg]);

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
      if (shapeEditMode) setSelectedVertex(null);
      else onSelect(null);
    }
  };

  // --- 부스 외곽 편집: 꼭짓점/Edge 드래그 (layer.getRelativePointerPosition 으로 회전까지 반영) ---
  const localPointer = () => shapeLayerRef.current?.getRelativePointerPosition() ?? null;

  const handleVertexDown = (index: number, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    dragRef.current = { type: 'vertex', index, last: { x: 0, y: 0 } };
    setSelectedVertex(index);
  };
  const handleEdgeDown = (index: number, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const p = localPointer();
    dragRef.current = { type: 'edge', index, last: p ?? { x: 0, y: 0 } };
    setSelectedVertex(null);
  };
  const handleAddVertex = (edgeIndex: number, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const pts = editPointsRef.current;
    if (!pts) return;
    const a = pts[edgeIndex];
    const b = pts[(edgeIndex + 1) % pts.length];
    const mid: PointMm = {
      xMm: snapMmToGrid((a.xMm + b.xMm) / 2, gridSizeMm),
      yMm: snapMmToGrid((a.yMm + b.yMm) / 2, gridSizeMm),
    };
    const next = [...pts];
    next.splice(edgeIndex + 1, 0, mid);
    setEditPoints(next);
    onBoothShapeChange?.(next);
  };

  const handleShapeMouseMove = () => {
    const drag = dragRef.current;
    if (!shapeEditMode || !drag) return;
    const local = localPointer();
    if (!local) return;
    if (drag.type === 'vertex') {
      const nx = snapMmToGrid(local.x, gridSizeMm);
      const ny = snapMmToGrid(local.y, gridSizeMm);
      setEditPoints((prev) => (prev ? prev.map((p, i) => (i === drag.index ? { xMm: nx, yMm: ny } : p)) : prev));
    } else {
      const dx = local.x - drag.last.x;
      const dy = local.y - drag.last.y;
      drag.last = { x: local.x, y: local.y };
      setEditPoints((prev) => {
        if (!prev) return prev;
        const j = (drag.index + 1) % prev.length;
        return prev.map((p, i) => (i === drag.index || i === j ? { xMm: p.xMm + dx, yMm: p.yMm + dy } : p));
      });
    }
  };

  const handleShapeMouseUp = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    let pts = editPointsRef.current ?? [];
    if (drag.type === 'edge') {
      const j = (drag.index + 1) % pts.length;
      pts = pts.map((p, i) =>
        i === drag.index || i === j
          ? { xMm: snapMmToGrid(p.xMm, gridSizeMm), yMm: snapMmToGrid(p.yMm, gridSizeMm) }
          : p,
      );
      setEditPoints(pts);
    }
    onBoothShapeChange?.(pts);
  };

  // 편집 모드 키보드: Delete(선택 꼭짓점 삭제, 최소 3개), ESC(종료)
  useEffect(() => {
    if (!shapeEditMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExitShapeEdit?.();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedVertex != null) {
        const pts = editPointsRef.current;
        if (pts && pts.length > 3) {
          const next = pts.filter((_, i) => i !== selectedVertex);
          setEditPoints(next);
          setSelectedVertex(null);
          onBoothShapeChange?.(next);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shapeEditMode, selectedVertex, onExitShapeEdit, onBoothShapeChange]);

  const ready =
    size.width > 0 && size.height > 0 && bounds.widthMm > 0 && bounds.depthMm > 0;

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
          onMouseMove={handleShapeMouseMove}
          onMouseUp={handleShapeMouseUp}
        >
          {/* 배경 레이어: 바닥/그리드/벽체/치수 (이벤트 비수신) */}
          <Layer listening={false} {...layerRot}>
            {/* 바닥 (폴리곤) */}
            <Line
              points={flattenPolygon(polygon)}
              closed
              fill={CANVAS_COLORS.floorFill}
              stroke="#cbd5e1"
              strokeWidth={1}
              strokeScaleEnabled={false}
            />
            {/* 그리드 (부스 폴리곤 내부로 클립) */}
            <Group clipFunc={(ctx) => clipPolygon(ctx, polygon)}>
              <GridLines bounds={bounds} gridSizeMm={gridSizeMm} />
            </Group>
            {/* 벽체 */}
            <Walls polygon={polygon} bounds={bounds} isPolygon={isPolygon} edges={edges} />
            {/* 치수 (바운딩 박스 기준) */}
            <Dimensions bounds={bounds} scale={viewport.scale} />
          </Layer>

          {/* 집기/텍스트/이미지/배경 레이어: 드래그/선택 상호작용 (회전/읽기전용/외곽편집 시 비활성) */}
          <Layer listening={interactive && !shapeEditMode} {...layerRot}>
            {/* SVG 배경 (맨 아래). 잠금 시 비상호작용 */}
            {backgrounds.map((bg) =>
              bg.locked ? (
                <KonvaImage
                  key={bg.id}
                  image={imageMap.get(bg.srcDataUrl)}
                  x={bg.xMm}
                  y={bg.yMm}
                  width={bg.widthMm}
                  height={bg.heightMm}
                  rotation={bg.rotationDeg}
                  opacity={bg.opacity}
                  listening={false}
                />
              ) : (
                <ImageNode
                  key={bg.id}
                  image={bg}
                  imageEl={imageMap.get(bg.srcDataUrl)}
                  register={register(bg.id)}
                  onSelect={onSelectBackground}
                  onChange={onChangeBackground}
                />
              ),
            )}
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
            {(selectedImageId || selectedBackgroundId) && (
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
            {placed.map((p) => {
              const def = fixturesById.get(p.fixtureDefId);
              if (!def) return null;
              const dm = planFaceMapping(p.design);
              const asset = dm ? assetById(designAssets, dm.assetId) : null;
              return (
                <FixtureNode
                  key={p.id}
                  placed={p}
                  def={def}
                  selected={selectedFixtureIds?.includes(p.id) ?? p.id === selectedFixtureId}
                  boothPolygon={polygon}
                  scale={viewport.scale}
                  showName={showFixtureNames}
                  designMapping={dm}
                  designImage={asset ? imageMap.get(asset.url) : undefined}
                  onSelect={onSelect}
                  onDragMove={handleFixtureDragMove}
                  onDragEnd={handleFixtureDragEnd}
                />
              );
            })}
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

          {/* 스냅 가이드라인 레이어 (명령형으로 그림, 드래그 종료 시 비움) */}
          <Layer ref={guideLayerRef} listening={false} {...layerRot} />

          {/* SVG 구조 검사 하이라이트 (읽기 전용, 상호작용 없음) */}
          {selectedSvgDoc && (
            <Layer listening={false} {...layerRot}>
              <SvgHighlightOverlay
                doc={selectedSvgDoc}
                highlightedElementId={highlightedSvgElementId ?? null}
                scale={viewport.scale}
              />
            </Layer>
          )}

          {/* 부스 외곽 편집 오버레이 (v0.8.6) */}
          {shapeEditMode && editPoints && (
            <Layer ref={shapeLayerRef} {...layerRot}>
              <ShapeEditor
                points={editPoints}
                scale={viewport.scale}
                selectedVertex={selectedVertex}
                hoverEdge={hoverEdge}
                onVertexDown={handleVertexDown}
                onEdgeDown={handleEdgeDown}
                onAddVertex={handleAddVertex}
                onEdgeEnter={setHoverEdge}
                onEdgeLeave={() => setHoverEdge(null)}
              />
            </Layer>
          )}
        </Stage>
      )}

      {/* 오버레이 툴바 */}
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
        1mm ≈ {viewport.scale.toFixed(3)}px · 그리드 {gridSizeMm}mm{isPolygon ? ' · 다각형' : ''}
      </Typography>
    </Box>
  );
}

/** 폴리곤 점들의 바운딩 박스 (편집 중 실시간 폴리곤 대응) */
function boundsFromPoints(pts: PointMm[]): BoothBounds {
  const xs = pts.map((p) => p.xMm);
  const ys = pts.map((p) => p.yMm);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, widthMm: maxX - minX, depthMm: maxY - minY };
}

/** 보기 회전(deg)을 반영한 화면 맞춤용 바운딩 박스(부스 중심 기준 회전한 AABB) */
function rotatedFitBounds(
  bounds: BoothBounds,
  deg: number,
): { minX: number; minY: number; widthMm: number; depthMm: number } {
  if (deg % 360 === 0) {
    return { minX: bounds.minX, minY: bounds.minY, widthMm: bounds.widthMm, depthMm: bounds.depthMm };
  }
  const cx = bounds.minX + bounds.widthMm / 2;
  const cy = bounds.minY + bounds.depthMm / 2;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [bounds.minX, bounds.minY],
    [bounds.maxX, bounds.minY],
    [bounds.maxX, bounds.maxY],
    [bounds.minX, bounds.maxY],
  ];
  const xs = corners.map(([x, y]) => cx + (x - cx) * cos - (y - cy) * sin);
  const ys = corners.map(([x, y]) => cy + (x - cx) * sin + (y - cy) * cos);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { minX, minY, widthMm: Math.max(...xs) - minX, depthMm: Math.max(...ys) - minY };
}

/** 폴리곤 클립 경로 그리기 */
function clipPolygon(ctx: Konva.Context, polygon: PointMm[]): void {
  ctx.beginPath();
  ctx.moveTo(polygon[0].xMm, polygon[0].yMm);
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i].xMm, polygon[i].yMm);
  }
  ctx.closePath();
}

/** 연한 내부 그리드 (바운딩 박스 범위, 폴리곤 클립은 부모 Group 이 담당) */
function GridLines({ bounds, gridSizeMm }: { bounds: BoothBounds; gridSizeMm: number }) {
  const { minX, minY, maxX, maxY } = bounds;
  const lines: React.ReactNode[] = [];
  const startX = Math.ceil(minX / gridSizeMm) * gridSizeMm;
  const startY = Math.ceil(minY / gridSizeMm) * gridSizeMm;
  for (let x = startX; x <= maxX + 0.5; x += gridSizeMm) {
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, minY, x, maxY]}
        stroke={CANVAS_COLORS.grid}
        strokeWidth={GRID_STROKE_PX}
        strokeScaleEnabled={false}
      />,
    );
  }
  for (let y = startY; y <= maxY + 0.5; y += gridSizeMm) {
    lines.push(
      <Line
        key={`h-${y}`}
        points={[minX, y, maxX, y]}
        stroke={CANVAS_COLORS.grid}
        strokeWidth={GRID_STROKE_PX}
        strokeScaleEnabled={false}
      />,
    );
  }
  return <>{lines}</>;
}

/**
 * 벽체 렌더링.
 *  - polygon: 모든 외곽선을 벽으로 (닫힌 폴리곤)
 *  - rectangle: 오픈면(openSide)에 따라 닫힌 변만 벽
 */
function Walls({
  polygon,
  bounds,
  isPolygon,
  edges,
}: {
  polygon: PointMm[];
  bounds: BoothBounds;
  isPolygon: boolean;
  edges: ReturnType<typeof getWallEdges>;
}) {
  if (isPolygon) {
    return (
      <Line
        points={flattenPolygon(polygon)}
        closed
        stroke={CANVAS_COLORS.wall}
        strokeWidth={WALL_STROKE_PX}
        strokeScaleEnabled={false}
        lineJoin="round"
      />
    );
  }

  const { minX, minY, maxX, maxY } = bounds;
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
      {edges.top && wall('wall-top', [minX, minY, maxX, minY])}
      {edges.right && wall('wall-right', [maxX, minY, maxX, maxY])}
      {edges.bottom && wall('wall-bottom', [minX, maxY, maxX, maxY])}
      {edges.left && wall('wall-left', [minX, minY, minX, maxY])}
    </>
  );
}

/** 가로/세로 치수(mm) 표시 — 바운딩 박스 기준 */
function Dimensions({ bounds, scale }: { bounds: BoothBounds; scale: number }) {
  const { minX, minY, maxX, maxY, widthMm, depthMm } = bounds;
  const vp: Viewport = { scale, x: 0, y: 0 };
  const gap = pxToMm(18, vp);
  const tick = pxToMm(5, vp);
  const font = pxToMm(DIM_LABEL_PX, vp);

  const lineStyle = {
    stroke: CANVAS_COLORS.dimLine,
    strokeWidth: DIM_LINE_PX,
    strokeScaleEnabled: false,
  } as const;

  const yb = maxY + gap; // 가로 치수선 y
  const xl = minX - gap; // 세로 치수선 x

  return (
    <>
      {/* 가로 치수 (아래쪽) */}
      <Line points={[minX, yb, maxX, yb]} {...lineStyle} />
      <Line points={[minX, yb - tick, minX, yb + tick]} {...lineStyle} />
      <Line points={[maxX, yb - tick, maxX, yb + tick]} {...lineStyle} />
      <Text
        text={`${widthMm} mm`}
        x={minX}
        y={yb + tick}
        width={widthMm}
        align="center"
        fontSize={font}
        fill={CANVAS_COLORS.dimText}
      />

      {/* 세로 치수 (왼쪽, 회전) */}
      <Line points={[xl, minY, xl, maxY]} {...lineStyle} />
      <Line points={[xl - tick, minY, xl + tick, minY]} {...lineStyle} />
      <Line points={[xl - tick, maxY, xl + tick, maxY]} {...lineStyle} />
      <Text
        text={`${depthMm} mm`}
        x={xl - tick}
        y={maxY}
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

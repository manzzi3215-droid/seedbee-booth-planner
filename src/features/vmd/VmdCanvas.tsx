import { useEffect, useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import { Stage, Layer, Rect, Group, Image as KonvaImage, Text, Ellipse, Line, Arrow, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { Product, VmdBoard, VmdElement } from '../../types';
import { useContainerSize } from '../canvas/useContainerSize';
import { useImageMap } from '../canvas/useDataUrlImage';
import { productImageUrl } from '../products/productModel';

/**
 * VMD Board 2D 캔버스 (v1.0.1). Konva Stage 로 보드 배경 + 요소를 mm 좌표로 렌더.
 * 선택/드래그/리사이즈/회전 지원. PNG alpha 유지(흰 배경 강제 없음).
 */

function productSrc(el: VmdElement, products: Product[]): string | undefined {
  if (el.type === 'product' && el.productId) {
    const p = products.find((x) => x.id === el.productId);
    return p ? productImageUrl(p, p.displayDirection ?? 'front') : undefined;
  }
  return el.src;
}

export default function VmdCanvas({
  board,
  products,
  selectedIds,
  onSelect,
  onChange,
  onCommit,
  registerExport,
}: {
  board: VmdBoard;
  products: Product[];
  selectedIds: string[];
  onSelect: (id: string | null, additive: boolean) => void;
  onChange: (id: string, patch: Partial<VmdElement>) => void;
  onCommit: () => void;
  registerExport: (fn: ((opts: { transparent: boolean; pixelRatio?: number }) => string | null) | null) => void;
}) {
  const { ref, size } = useContainerSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const bgGroupRef = useRef<Konva.Group>(null);

  // 이미지 소스 수집
  const srcs = useMemo(() => {
    const arr: string[] = [];
    if (board.background.mode === 'image' && board.background.imageSrc) arr.push(board.background.imageSrc);
    for (const el of board.elements) {
      const s = productSrc(el, products);
      if (s) arr.push(s);
    }
    return arr;
  }, [board, products]);
  const imageMap = useImageMap(srcs);

  // 보드를 컨테이너에 맞게 fit (컨테이너 크기 0 일 때 음수/무한대 방지)
  const pad = 40;
  const fit = Math.min(
    (size.width - pad * 2) / board.widthMm,
    (size.height - pad * 2) / board.heightMm,
  );
  const scale = Number.isFinite(fit) && fit > 0.01 ? fit : 0.2;
  const offX = (size.width - board.widthMm * scale) / 2;
  const offY = (size.height - board.heightMm * scale) / 2;

  // Transformer 를 선택 요소에 부착 (단일 선택시만 리사이즈/회전)
  useEffect(() => {
    const tr = trRef.current;
    const layer = layerRef.current;
    if (!tr || !layer) return;
    if (selectedIds.length === 1) {
      const node = layer.findOne(`#el-${selectedIds[0]}`);
      const el = board.elements.find((e) => e.id === selectedIds[0]);
      if (node && el && !el.locked && el.type !== 'line') {
        tr.nodes([node]);
        tr.getLayer()?.batchDraw();
        return;
      }
    }
    tr.nodes([]);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, board.elements, scale]);

  // 내보내기 함수 등록 (보드 영역만 crop, 투명이면 배경 숨김)
  useEffect(() => {
    const fn = (opts: { transparent: boolean; pixelRatio?: number }): string | null => {
      const stage = stageRef.current;
      if (!stage || size.width === 0) return null;
      const tr = trRef.current;
      tr?.nodes([]);
      const bgGroup = bgGroupRef.current;
      const prevVisible = bgGroup?.visible() ?? true;
      if (opts.transparent) bgGroup?.visible(false);
      // 내보내기 중 그림자 비활성화 (Konva shadow 버퍼가 toDataURL 에서 0-size 오류를 내는 문제 회피)
      const shadowed = (stage.find('Rect') as Konva.Rect[]).filter((n) => n.shadowEnabled() && n.shadowBlur() > 0);
      shadowed.forEach((n) => n.shadowEnabled(false));
      stage.batchDraw();
      let url: string | null = null;
      try {
        url = stage.toDataURL({
          x: offX,
          y: offY,
          width: board.widthMm * scale,
          height: board.heightMm * scale,
          pixelRatio: Math.min(6, (opts.pixelRatio ?? 3) / scale),
        });
      } catch {
        url = null;
      }
      shadowed.forEach((n) => n.shadowEnabled(true));
      if (opts.transparent) bgGroup?.visible(prevVisible);
      stage.batchDraw();
      return url;
    };
    registerExport(fn);
    return () => registerExport(null);
  }, [registerExport, offX, offY, scale, size.width, board.widthMm, board.heightMm]);

  const bg = board.background;

  const handleDragEnd = (el: VmdElement, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onChange(el.id, { xMm: Math.round(node.x()), yMm: Math.round(node.y()) });
    onCommit();
  };

  const handleTransformEnd = (el: VmdElement, e: Konva.KonvaEventObject<Event>) => {
    const node = e.target as Konva.Node;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange(el.id, {
      xMm: Math.round(node.x()),
      yMm: Math.round(node.y()),
      widthMm: Math.max(10, Math.round(el.widthMm * sx)),
      heightMm: Math.max(10, Math.round(el.heightMm * sy)),
      rotationDeg: Math.round(node.rotation()),
    });
    onCommit();
  };

  const renderElement = (el: VmdElement) => {
    if (el.hidden) return null;
    const common = {
      id: `el-${el.id}`,
      x: el.xMm,
      y: el.yMm,
      rotation: el.rotationDeg,
      opacity: el.opacity,
      draggable: !el.locked,
      onMouseDown: (e: Konva.KonvaEventObject<MouseEvent>) => onSelect(el.id, e.evt.shiftKey),
      onTap: () => onSelect(el.id, false),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(el, e),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(el, e),
    };

    if (el.type === 'line') {
      const pts = [0, 0, (el.x2Mm ?? el.xMm + 200) - el.xMm, (el.y2Mm ?? el.yMm) - el.yMm];
      const P = el.arrow ? Arrow : Line;
      return (
        <P
          key={el.id}
          {...common}
          points={pts}
          stroke={el.stroke ?? '#0f172a'}
          strokeWidth={(el.strokeWidthMm ?? 4)}
          pointerLength={el.arrow ? 24 : 0}
          pointerWidth={el.arrow ? 24 : 0}
          hitStrokeWidth={20}
        />
      );
    }

    if (el.type === 'text') {
      return (
        <Group key={el.id} {...common} width={el.widthMm} height={el.heightMm}>
          {el.bgColor && <Rect width={el.widthMm} height={el.heightMm} fill={el.bgColor} cornerRadius={8} />}
          <Text
            width={el.widthMm}
            height={el.heightMm}
            text={el.text || '텍스트'}
            fontSize={el.fontSizeMm ?? 60}
            fontStyle={el.bold ? 'bold' : 'normal'}
            fill={el.color ?? '#0f172a'}
            align={el.align ?? 'center'}
            verticalAlign="middle"
            wrap="word"
          />
        </Group>
      );
    }

    if (el.type === 'shape') {
      if (el.shape === 'circle') {
        return (
          <Ellipse
            key={el.id}
            {...common}
            x={el.xMm + el.widthMm / 2}
            y={el.yMm + el.heightMm / 2}
            radiusX={el.widthMm / 2}
            radiusY={el.heightMm / 2}
            fill={el.fill ?? '#fde047'}
            stroke={el.stroke}
            strokeWidth={el.strokeWidthMm ?? 0}
          />
        );
      }
      return (
        <Rect
          key={el.id}
          {...common}
          width={el.widthMm}
          height={el.heightMm}
          fill={el.fill ?? '#fde047'}
          stroke={el.stroke}
          strokeWidth={el.strokeWidthMm ?? 0}
          cornerRadius={8}
        />
      );
    }

    // product / image
    const src = productSrc(el, products);
    const imgRaw = src ? imageMap.get(src) : undefined;
    const img = imgRaw && (imgRaw.naturalWidth || 0) > 0 ? imgRaw : undefined;
    if (img) {
      return <KonvaImage key={el.id} {...common} image={img} width={el.widthMm} height={el.heightMm} />;
    }
    return (
      <Group key={el.id} {...common} width={el.widthMm} height={el.heightMm}>
        <Rect width={el.widthMm} height={el.heightMm} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={2} cornerRadius={6} />
        <Text width={el.widthMm} height={el.heightMm} text={el.name} align="center" verticalAlign="middle" fontSize={40} fill="#64748b" />
      </Group>
    );
  };

  const bgImgRaw = bg.mode === 'image' && bg.imageSrc ? imageMap.get(bg.imageSrc) : undefined;
  // 로드 실패/미완료 이미지(0 size)는 pattern 으로 쓰지 않음(Konva drawImage 오류 방지)
  const bgImg = bgImgRaw && (bgImgRaw.naturalWidth || 0) > 0 ? bgImgRaw : undefined;
  const bgPatternProps = bgImg
    ? {
        fillPatternImage: bgImg,
        fillPatternScaleX: board.widthMm / (bgImg.naturalWidth || bgImg.width),
        fillPatternScaleY: board.heightMm / (bgImg.naturalHeight || bgImg.height),
      }
    : {};

  // 컨테이너 크기가 확정되기 전에는 Stage 를 그리지 않음(0-size 렌더 시 Konva shadow 오류 방지)
  if (size.width < 2 || size.height < 2) {
    return <Box ref={ref} sx={{ width: '100%', height: '100%', bgcolor: '#eef1f5' }} />;
  }

  return (
    <Box ref={ref} sx={{ width: '100%', height: '100%', bgcolor: '#eef1f5' }}>
      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) onSelect(null, false);
        }}
      >
        <Layer ref={layerRef} x={offX} y={offY} scaleX={scale} scaleY={scale}>
          <Group ref={bgGroupRef}>
          {/* 받침대(있으면 보드 아래 그림자 판) */}
          {bg.pedestal && (
            <Rect
              x={-board.widthMm * 0.04}
              y={board.heightMm * 0.9}
              width={board.widthMm * 1.08}
              height={board.heightMm * 0.16}
              fill="#dfe4ea"
              cornerRadius={12}
              shadowColor="#000"
              shadowBlur={30}
              shadowOpacity={0.18}
              shadowOffsetY={10}
            />
          )}
          {/* 보드 배경 */}
          {bg.mode !== 'transparent' && (
            <Rect
              width={board.widthMm}
              height={board.heightMm}
              cornerRadius={bg.radiusMm ?? 0}
              fill={bg.mode === 'image' && bgImg ? undefined : bg.color ?? '#f1f5f9'}
              {...bgPatternProps}
              stroke={bg.outline ? bg.outlineColor ?? '#cbd5e1' : undefined}
              strokeWidth={bg.outline ? 4 : 0}
              shadowColor={bg.shadow ? '#000' : undefined}
              shadowBlur={bg.shadow ? 40 : 0}
              shadowOpacity={bg.shadow ? 0.15 : 0}
              shadowOffsetY={bg.shadow ? 12 : 0}
            />
          )}
          {bg.mode === 'transparent' && bg.outline && (
            <Rect width={board.widthMm} height={board.heightMm} cornerRadius={bg.radiusMm ?? 0} stroke={bg.outlineColor ?? '#cbd5e1'} strokeWidth={4} dash={[24, 16]} />
          )}
          </Group>

          {board.elements.map(renderElement)}

          {/* 다중 선택 하이라이트 */}
          {selectedIds.length > 1 &&
            board.elements
              .filter((e) => selectedIds.includes(e.id) && !e.hidden)
              .map((e) => (
                <Rect key={`sel-${e.id}`} x={e.xMm} y={e.yMm} width={e.widthMm} height={e.heightMm} rotation={e.rotationDeg} stroke="#7c3aed" strokeWidth={3} dash={[10, 6]} listening={false} />
              ))}

          <Transformer
            ref={trRef}
            rotateEnabled
            keepRatio={false}
            anchorSize={12 / scale}
            borderStrokeWidth={2 / scale}
            anchorStrokeWidth={2 / scale}
            boundBoxFunc={(oldB, newB) => (newB.width < 10 || newB.height < 10 ? oldB : newB)}
          />
        </Layer>
      </Stage>
    </Box>
  );
}

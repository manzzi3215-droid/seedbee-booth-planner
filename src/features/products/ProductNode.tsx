import { Group, Rect, Image as KonvaImage, Text } from 'react-konva';
import type Konva from 'konva';
import type { PlacedProduct, Product } from '../../types';
import { productSize, DEFAULT_PRODUCT_COLOR } from './productModel';

const SELECT_COLOR = '#7c3aed';
const COLLIDE_COLOR = '#dc2626';
const NAME_MIN_PX = 30;

/**
 * 배치된 제품 하나 (Product Layer, v0.9.3). Konva Stage 자식이므로 훅 미사용.
 * 썸네일 이미지가 있으면 이미지, 없으면 진열색 박스로 렌더. 충돌 시 빨간 테두리.
 */
export default function ProductNode({
  placed,
  product,
  selected,
  collided,
  scale,
  image,
  onSelect,
  onDragMove,
  onDragEnd,
}: {
  placed: PlacedProduct;
  product: Product;
  selected: boolean;
  collided: boolean;
  scale: number;
  image?: HTMLImageElement;
  onSelect: (id: string) => void;
  onDragMove: (id: string, xMm: number, yMm: number) => { xMm: number; yMm: number };
  onDragEnd: (id: string, xMm: number, yMm: number) => void;
}) {
  const { w, d } = productSize(product, placed);
  const color = product.displayColor || DEFAULT_PRODUCT_COLOR;
  const showName = w * scale >= NAME_MIN_PX && d * scale >= NAME_MIN_PX * 0.6;

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const s = onDragMove(placed.id, node.x(), node.y());
    node.position({ x: s.xMm, y: s.yMm });
  };
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(placed.id, node.x(), node.y());
  };

  const border = collided ? COLLIDE_COLOR : SELECT_COLOR;

  return (
    <Group
      x={placed.xMm}
      y={placed.yMm}
      rotation={placed.rotationDeg}
      draggable={!placed.lock}
      onMouseDown={() => onSelect(placed.id)}
      onTouchStart={() => onSelect(placed.id)}
      onDragStart={() => onSelect(placed.id)}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      {image ? (
        <>
          {/* Solid 배경 모드일 때만 이미지 뒤에 진열색을 채움. transparent/미지정은 PNG alpha 유지(§2,§3) */}
          {product.backgroundMode === 'solid' && (
            <Rect width={w} height={d} fill={color} cornerRadius={Math.min(w, d) * 0.08} />
          )}
          <KonvaImage image={image} width={w} height={d} />
        </>
      ) : (
        <Rect width={w} height={d} fill={color} cornerRadius={Math.min(w, d) * 0.08} stroke="rgba(0,0,0,0.3)" strokeWidth={1} strokeScaleEnabled={false} />
      )}
      {showName && (
        <Text
          text={product.name}
          width={w}
          height={d}
          align="center"
          verticalAlign="middle"
          wrap="none"
          ellipsis
          fontSize={11 / scale}
          fill="#111827"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth={2 / scale}
          fillAfterStrokeEnabled
          listening={false}
          padding={2}
        />
      )}
      {(selected || collided) && (
        <Rect
          width={w}
          height={d}
          stroke={border}
          strokeWidth={selected ? 2.5 : 2}
          strokeScaleEnabled={false}
          dash={collided && !selected ? [8, 5] : undefined}
          shadowColor={border}
          shadowBlur={selected ? 6 : 0}
          shadowOpacity={0.5}
          listening={false}
        />
      )}
    </Group>
  );
}

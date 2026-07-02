import { Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { PlacedImage } from '../../types';

const MIN_MM = 50;

interface ImageNodeProps {
  image: PlacedImage;
  /** 미리 로드된 이미지 요소 (캔버스 레벨에서 로드) */
  imageEl: HTMLImageElement | undefined;
  /** 캔버스 레벨 Transformer 에 노드를 등록하는 콜백 ref */
  register: (node: Konva.Image | null) => void;
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<PlacedImage>) => void;
}

/**
 * 배치 이미지 노드 (훅 없음 — Konva 트리 안전).
 * 크기/회전 조절은 캔버스 레벨 Transformer 가 담당하고,
 * 여기서는 드래그/크기변경 결과를 mm 로 반영합니다.
 */
export default function ImageNode({ image, imageEl, register, onSelect, onChange }: ImageNodeProps) {
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const n = e.target;
    onChange(image.id, { xMm: n.x(), yMm: n.y() });
  };

  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target as Konva.Image;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    onChange(image.id, {
      xMm: node.x(),
      yMm: node.y(),
      widthMm: Math.max(MIN_MM, node.width() * sx),
      heightMm: Math.max(MIN_MM, node.height() * sy),
      rotationDeg: node.rotation(),
    });
  };

  return (
    <KonvaImage
      ref={register}
      image={imageEl}
      x={image.xMm}
      y={image.yMm}
      width={image.widthMm}
      height={image.heightMm}
      rotation={image.rotationDeg}
      opacity={image.opacity}
      draggable
      onMouseDown={() => onSelect(image.id)}
      onTouchStart={() => onSelect(image.id)}
      onDragStart={() => onSelect(image.id)}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    />
  );
}

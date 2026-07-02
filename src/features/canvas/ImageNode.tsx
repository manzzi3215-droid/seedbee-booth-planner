import { useEffect, useRef } from 'react';
import { Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { PlacedImage } from '../../types';
import { useDataUrlImage } from './useDataUrlImage';

const MIN_MM = 50;

interface ImageNodeProps {
  image: PlacedImage;
  selected: boolean;
  scale: number; // px/mm — Transformer 핸들을 화면상 일정 크기로
  onSelect: (id: string) => void;
  onChange: (id: string, patch: Partial<PlacedImage>) => void;
}

/**
 * 배치 이미지 노드. Konva.Image + 선택 시 Transformer(크기/회전 조절).
 * 크기 조절 후 scale 을 1로 되돌리고 width/height(mm) 로 반영합니다.
 */
export default function ImageNode({ image, selected, scale, onSelect, onChange }: ImageNodeProps) {
  const el = useDataUrlImage(image.srcDataUrl);
  const shapeRef = useRef<Konva.Image>(null);
  const trRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    if (selected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected, el]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const n = e.target;
    onChange(image.id, { xMm: n.x(), yMm: n.y() });
  };

  const handleTransformEnd = () => {
    const node = shapeRef.current;
    if (!node) return;
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
    <>
      <KonvaImage
        ref={shapeRef}
        image={el}
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
      {selected && el && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          anchorSize={14 / scale}
          anchorStrokeWidth={1.5 / scale}
          borderStrokeWidth={1.5 / scale}
          rotateAnchorOffset={26 / scale}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 5 || newBox.height < 5 ? oldBox : newBox)}
        />
      )}
    </>
  );
}

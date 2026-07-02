import { Label, Tag, Text } from 'react-konva';
import type Konva from 'konva';
import type { PlacedText } from '../../types';
import { TEXT_FONT_FAMILY } from '../texts/constants';

const SELECT_COLOR = '#2563eb';

interface TextNodeProps {
  text: PlacedText;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, xMm: number, yMm: number) => void;
}

/**
 * 캔버스 자유 텍스트 노드.
 * Konva Label + Tag(배경) + Text 로 구성. 좌표/글자크기 모두 mm.
 * 배경(Tag)이 Text 크기에 맞춰 자동 크기 조정되므로 선택 테두리도 여기에 그린다.
 */
export default function TextNode({ text, selected, onSelect, onMove }: TextNodeProps) {
  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onMove(text.id, node.x(), node.y());
  };

  const pad = Math.max(text.fontSizeMm * 0.15, 20); // 배경/테두리 여백(mm)

  return (
    <Label
      x={text.xMm}
      y={text.yMm}
      rotation={text.rotationDeg}
      draggable
      onMouseDown={() => onSelect(text.id)}
      onTouchStart={() => onSelect(text.id)}
      onDragStart={() => onSelect(text.id)}
      onDragEnd={handleDragEnd}
    >
      <Tag
        fill={text.backgroundColor || undefined}
        stroke={selected ? SELECT_COLOR : undefined}
        strokeWidth={selected ? 2 : 0}
        strokeScaleEnabled={false}
        cornerRadius={pad * 0.4}
      />
      <Text
        text={text.text || ' '}
        fontSize={text.fontSizeMm}
        fontFamily={TEXT_FONT_FAMILY}
        fontStyle={text.bold ? 'bold' : 'normal'}
        fill={text.color}
        align={text.align}
        padding={pad}
      />
    </Label>
  );
}

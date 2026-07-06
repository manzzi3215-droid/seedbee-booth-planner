import { Group, Image as KonvaImage, Rect } from 'react-konva';
import type { FaceMapping } from '../../types';
import { computeFitRect } from './mapping';

/**
 * 집기 위에 디자인 텍스처를 그리는 Konva 노드 (2D 평면도, req #9).
 * 집기 바운딩 박스(w×d)에 클립하고, 매핑 방식/변형/투명도를 적용합니다.
 * Stage 트리 내부이므로 React 훅을 쓰지 않습니다.
 */
export default function DesignTextureNode({
  image,
  w,
  d,
  mapping,
}: {
  image: HTMLImageElement | undefined;
  w: number;
  d: number;
  mapping: FaceMapping;
}) {
  if (!image) return null;
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const t = mapping.transform;

  // 집기 영역으로 클립
  const clip = (ctx: import('konva/lib/Context').Context) => {
    ctx.beginPath();
    ctx.rect(0, 0, w, d);
    ctx.closePath();
  };

  if (mapping.mode === 'tile') {
    const base = iw > 0 ? w / iw / 3 : 1; // 약 3타일/폭 기준
    return (
      <Group clipFunc={clip} listening={false}>
        <Rect
          x={0}
          y={0}
          width={w}
          height={d}
          fillPatternImage={image}
          fillPatternRepeat="repeat"
          fillPatternScaleX={base * t.scale * (t.flipH ? -1 : 1)}
          fillPatternScaleY={base * t.scale * (t.flipV ? -1 : 1)}
          fillPatternRotation={t.rotationDeg}
          fillPatternOffsetX={-t.offsetX * w}
          fillPatternOffsetY={-t.offsetY * d}
          opacity={t.opacity}
          listening={false}
        />
      </Group>
    );
  }

  const { dw, dh } = computeFitRect(iw, ih, w, d, mapping.mode);
  const sdw = dw * t.scale;
  const sdh = dh * t.scale;
  const cx = w / 2 + t.offsetX * w;
  const cy = d / 2 + t.offsetY * d;

  return (
    <Group clipFunc={clip} listening={false}>
      <KonvaImage
        image={image}
        width={sdw}
        height={sdh}
        offsetX={sdw / 2}
        offsetY={sdh / 2}
        x={cx}
        y={cy}
        rotation={t.rotationDeg}
        scaleX={t.flipH ? -1 : 1}
        scaleY={t.flipV ? -1 : 1}
        opacity={t.opacity}
        listening={false}
      />
    </Group>
  );
}

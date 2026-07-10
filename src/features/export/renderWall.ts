import Konva from 'konva';
import type { PlacedDimension, PlacedImage, PlacedText } from '../../types';
import {
  CANVAS_COLORS,
  DEFAULT_GRID_SIZE_MM,
  GRID_STROKE_PX,
  WALL_STROKE_PX,
} from '../canvas/constants';
import { buildTextLabel, buildDimensionGroup, buildImageNode } from './renderBooth';

/**
 * 벽면 전개도 export 렌더러.
 * 가로=벽 길이, 세로=높이(mm). 화면 상태와 무관하게 벽면 전체를 그려 PNG dataURL 반환.
 */
const MARGIN_PX = 90;
const TARGET_PX = 1500;
const WALL_FILL = '#e9edf2';

interface WallRenderOptions {
  gridSizeMm?: number;
  pixelRatio?: number;
  /** 벽 배경색 (v1.1.7). 미지정 시 기본 연회색. */
  wallColor?: string;
}

export function createWallDrawingDataURL(
  wallLengthMm: number,
  heightMm: number,
  texts: PlacedText[],
  dimensions: PlacedDimension[],
  images: PlacedImage[],
  imageElements: Map<string, HTMLImageElement>,
  options: WallRenderOptions = {},
): string {
  const gridSizeMm = options.gridSizeMm ?? DEFAULT_GRID_SIZE_MM;
  const scale = TARGET_PX / Math.max(wallLengthMm, heightMm);
  const stageW = wallLengthMm * scale + MARGIN_PX * 2;
  const stageH = heightMm * scale + MARGIN_PX * 2;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-100000px';
  container.style.top = '0';
  document.body.appendChild(container);

  const stage = new Konva.Stage({ container, width: stageW, height: stageH });
  try {
    const bg = new Konva.Layer({ listening: false });
    bg.add(new Konva.Rect({ x: 0, y: 0, width: stageW, height: stageH, fill: '#ffffff' }));
    stage.add(bg);

    const layer = new Konva.Layer({ x: MARGIN_PX, y: MARGIN_PX, scaleX: scale, scaleY: scale, listening: false });
    stage.add(layer);

    // 벽면
    layer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: wallLengthMm,
        height: heightMm,
        fill: options.wallColor ?? WALL_FILL,
        stroke: CANVAS_COLORS.wall,
        strokeWidth: WALL_STROKE_PX,
        strokeScaleEnabled: false,
      }),
    );

    // 그리드
    for (let x = 0; x <= wallLengthMm + 0.5; x += gridSizeMm) {
      const xi = Math.min(x, wallLengthMm);
      layer.add(new Konva.Line({ points: [xi, 0, xi, heightMm], stroke: CANVAS_COLORS.grid, strokeWidth: GRID_STROKE_PX, strokeScaleEnabled: false }));
    }
    for (let y = 0; y <= heightMm + 0.5; y += gridSizeMm) {
      const yi = Math.min(y, heightMm);
      layer.add(new Konva.Line({ points: [0, yi, wallLengthMm, yi], stroke: CANVAS_COLORS.grid, strokeWidth: GRID_STROKE_PX, strokeScaleEnabled: false }));
    }

    // 요소 (이미지 → 텍스트 → 치수선)
    for (const img of images) {
      const node = buildImageNode(img, imageElements);
      if (node) layer.add(node);
    }
    for (const t of texts) layer.add(buildTextLabel(t));
    for (const d of dimensions) layer.add(buildDimensionGroup(d, scale));

    // 치수 라벨 (가로=벽 길이, 세로=높이)
    const labelFont = 24 / scale;
    layer.add(new Konva.Text({ x: 0, y: heightMm + 26 / scale, width: wallLengthMm, align: 'center', text: `${wallLengthMm} mm`, fontSize: labelFont, fill: CANVAS_COLORS.dimText }));
    layer.add(new Konva.Text({ x: -26 / scale, y: heightMm, width: heightMm, align: 'center', rotation: -90, offsetY: labelFont + 2 / scale, text: `${heightMm} mm`, fontSize: labelFont, fill: CANVAS_COLORS.dimText }));

    return stage.toDataURL({ pixelRatio: options.pixelRatio ?? 2 });
  } finally {
    stage.destroy();
    container.remove();
  }
}

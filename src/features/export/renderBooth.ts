import Konva from 'konva';
import type { BoothConfig, FixtureDef, PlacedFixture } from '../../types';
import {
  CANVAS_COLORS,
  DEFAULT_GRID_SIZE_MM,
  GRID_STROKE_PX,
  WALL_STROKE_PX,
  getWallEdges,
} from '../canvas/constants';

/**
 * export 전용 부스 도면 렌더러.
 *
 * 화면의 확대/축소/이동 상태와 무관하게, 항상 부스 전체가 일정한 여백/해상도로
 * 나오도록 오프스크린 Konva Stage 에 그린 뒤 PNG dataURL 을 반환합니다.
 */

const MARGIN_PX = 90; // 부스 외곽 여백(px)
const TARGET_PX = 1500; // 부스의 큰 변이 차지할 목표 픽셀

interface RenderOptions {
  gridSizeMm?: number;
  pixelRatio?: number;
}

export function createBoothDrawingDataURL(
  booth: BoothConfig,
  placed: PlacedFixture[],
  fixturesById: Map<string, FixtureDef>,
  options: RenderOptions = {},
): string {
  const gridSizeMm = options.gridSizeMm ?? DEFAULT_GRID_SIZE_MM;
  const boothW = booth.widthMm;
  const boothD = booth.depthMm;

  const scale = TARGET_PX / Math.max(boothW, boothD);
  const contentW = boothW * scale;
  const contentH = boothD * scale;
  const stageW = contentW + MARGIN_PX * 2;
  const stageH = contentH + MARGIN_PX * 2;

  // 오프스크린 컨테이너
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-100000px';
  container.style.top = '0';
  document.body.appendChild(container);

  const stage = new Konva.Stage({ container, width: stageW, height: stageH });

  try {
    // 흰 배경
    const bgLayer = new Konva.Layer({ listening: false });
    bgLayer.add(new Konva.Rect({ x: 0, y: 0, width: stageW, height: stageH, fill: '#ffffff' }));
    stage.add(bgLayer);

    // 도면 레이어 (mm 좌표, 여백만큼 offset + scale)
    const layer = new Konva.Layer({
      x: MARGIN_PX,
      y: MARGIN_PX,
      scaleX: scale,
      scaleY: scale,
      listening: false,
    });
    stage.add(layer);

    // 바닥
    layer.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: boothW,
        height: boothD,
        fill: CANVAS_COLORS.floorFill,
        stroke: '#cbd5e1',
        strokeWidth: 1,
        strokeScaleEnabled: false,
      }),
    );

    // 그리드
    for (let x = 0; x <= boothW + 0.5; x += gridSizeMm) {
      const xi = Math.min(x, boothW);
      layer.add(
        new Konva.Line({
          points: [xi, 0, xi, boothD],
          stroke: CANVAS_COLORS.grid,
          strokeWidth: GRID_STROKE_PX,
          strokeScaleEnabled: false,
        }),
      );
    }
    for (let y = 0; y <= boothD + 0.5; y += gridSizeMm) {
      const yi = Math.min(y, boothD);
      layer.add(
        new Konva.Line({
          points: [0, yi, boothW, yi],
          stroke: CANVAS_COLORS.grid,
          strokeWidth: GRID_STROKE_PX,
          strokeScaleEnabled: false,
        }),
      );
    }

    // 벽체 (닫힌 변만)
    const edges = getWallEdges(booth.openSide);
    const addWall = (points: number[]) =>
      layer.add(
        new Konva.Line({
          points,
          stroke: CANVAS_COLORS.wall,
          strokeWidth: WALL_STROKE_PX,
          strokeScaleEnabled: false,
          lineCap: 'square',
        }),
      );
    if (edges.top) addWall([0, 0, boothW, 0]);
    if (edges.right) addWall([boothW, 0, boothW, boothD]);
    if (edges.bottom) addWall([0, boothD, boothW, boothD]);
    if (edges.left) addWall([0, 0, 0, boothD]);

    // 집기
    for (const p of placed) {
      const def = fixturesById.get(p.fixtureDefId);
      if (!def) continue;
      layer.add(buildFixtureGroup(p, def, scale));
    }

    // 치수 라벨
    const labelFont = 24 / scale;
    layer.add(
      new Konva.Text({
        x: 0,
        y: boothD + 26 / scale,
        width: boothW,
        align: 'center',
        text: `${boothW} mm`,
        fontSize: labelFont,
        fill: CANVAS_COLORS.dimText,
      }),
    );
    layer.add(
      new Konva.Text({
        x: -26 / scale,
        y: boothD,
        width: boothD,
        align: 'center',
        rotation: -90,
        offsetY: labelFont + 2 / scale,
        text: `${boothD} mm`,
        fontSize: labelFont,
        fill: CANVAS_COLORS.dimText,
      }),
    );

    return stage.toDataURL({ pixelRatio: options.pixelRatio ?? 2 });
  } finally {
    stage.destroy();
    container.remove();
  }
}

/** 배치 집기 하나를 그리는 Konva.Group (형태별) + 이름 라벨 */
function buildFixtureGroup(p: PlacedFixture, def: FixtureDef, scale: number): Konva.Group {
  const group = new Konva.Group({ x: p.xMm, y: p.yMm, rotation: p.rotationDeg });
  const w = def.widthMm;
  const d = def.depthMm;
  const outline = 'rgba(0,0,0,0.35)';
  const common = { stroke: outline, strokeWidth: 1, strokeScaleEnabled: false };

  switch (def.shape) {
    case 'rectangle':
      group.add(new Konva.Rect({ width: w, height: d, fill: def.color, ...common }));
      break;
    case 'roundedRectangle':
      group.add(
        new Konva.Rect({
          width: w,
          height: d,
          fill: def.color,
          cornerRadius: def.cornerRadiusMm ?? 0,
          ...common,
        }),
      );
      break;
    case 'circle':
      group.add(
        new Konva.Ellipse({
          x: w / 2,
          y: d / 2,
          radiusX: w / 2,
          radiusY: d / 2,
          fill: def.color,
          ...common,
        }),
      );
      break;
    default:
      // semicircle / customPath: placeholder
      group.add(new Konva.Rect({ width: w, height: d, fill: def.color, opacity: 0.3 }));
      group.add(new Konva.Line({ points: [0, 0, w, d], stroke: def.color, strokeWidth: 1, strokeScaleEnabled: false }));
      group.add(new Konva.Line({ points: [w, 0, 0, d], stroke: def.color, strokeWidth: 1, strokeScaleEnabled: false }));
      group.add(
        new Konva.Rect({
          width: w,
          height: d,
          stroke: def.color,
          dash: [10, 6],
          strokeWidth: 1.5,
          strokeScaleEnabled: false,
        }),
      );
      break;
  }

  // 이름 라벨 (어떤 배경색에서도 읽히도록 흰 글자 + 어두운 외곽선)
  group.add(
    new Konva.Text({
      width: w,
      height: d,
      align: 'center',
      verticalAlign: 'middle',
      text: def.name,
      fontSize: 20 / scale,
      fontStyle: 'bold',
      fill: '#ffffff',
      stroke: 'rgba(0,0,0,0.65)',
      strokeWidth: (2 / scale),
      fillAfterStrokeEnabled: true,
      listening: false,
    }),
  );

  return group;
}

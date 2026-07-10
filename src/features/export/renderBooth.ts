import Konva from 'konva';
import type {
  BoothConfig,
  DesignAsset,
  FaceMapping,
  FixtureDef,
  PlacedDimension,
  PlacedFixture,
  PlacedImage,
  PlacedProduct,
  PlacedText,
  Product,
  WallSide,
} from '../../types';
import { DEFAULT_TEXTURE_TRANSFORM } from '../../types';
import { getWallColor } from '../wall/constants';
import { planFaceMapping, assetById, computeFitRect } from '../design/mapping';
import { productById as findProduct, productImageUrl, productSize, DEFAULT_PRODUCT_COLOR } from '../products/productModel';
import { TEXT_FONT_FAMILY } from '../texts/constants';
import { dimensionDisplayLabel, DIMENSION_FONT_FAMILY } from '../dimensions/constants';
import {
  CANVAS_COLORS,
  DEFAULT_GRID_SIZE_MM,
  GRID_STROKE_PX,
  WALL_STROKE_PX,
  getWallEdges,
} from '../canvas/constants';
import {
  getBoothShape,
  getBoothOutline,
  getBoothBounds,
  flattenPolygon,
} from '../canvas/boothGeometry';
import { CUSTOM_PATH_VIEW } from '../fixtures/shapes';
import { fillColor } from '../colors/palette';

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
  /** 디자인 에셋 (텍스처 참조) — 집기 위 디자인 렌더용 (v0.8.7) */
  designAssets?: DesignAsset[];
  /** 그리드 표시 (기본 true). Presentation 모드에서 false (v0.8.8) */
  showGrid?: boolean;
  /** 치수(부스 치수 라벨 + 사용자 치수선) 표시 (기본 true). Presentation 모드에서 false (v0.8.8) */
  showDimensions?: boolean;
  /** 배치 제품 (v0.9.3 Merchandising) */
  placedProducts?: PlacedProduct[];
  products?: Product[];
}

export function createBoothDrawingDataURL(
  booth: BoothConfig,
  placed: PlacedFixture[],
  texts: PlacedText[],
  dimensions: PlacedDimension[],
  images: PlacedImage[],
  backgrounds: PlacedImage[],
  imageElements: Map<string, HTMLImageElement>,
  fixturesById: Map<string, FixtureDef>,
  showFixtureNames: boolean,
  options: RenderOptions = {},
): string {
  const gridSizeMm = options.gridSizeMm ?? DEFAULT_GRID_SIZE_MM;
  const isPolygon = getBoothShape(booth) === 'polygon';
  const polygon = getBoothOutline(booth); // 곡선(bulge) 반영 외곽선 (v1.0.9)
  const bounds = getBoothBounds(booth);
  const { minX, minY, maxX, maxY, widthMm: boothW, depthMm: boothD } = bounds;

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

    // 도면 레이어 (mm 좌표). 바운딩 박스 minX/minY 오프셋 보정 + 여백.
    const layer = new Konva.Layer({
      x: MARGIN_PX - minX * scale,
      y: MARGIN_PX - minY * scale,
      scaleX: scale,
      scaleY: scale,
      listening: false,
    });
    stage.add(layer);

    // 바닥 (폴리곤)
    layer.add(
      new Konva.Line({
        points: flattenPolygon(polygon),
        closed: true,
        fill: CANVAS_COLORS.floorFill,
        stroke: '#cbd5e1',
        strokeWidth: 1,
        strokeScaleEnabled: false,
      }),
    );

    // 그리드 (부스 폴리곤 내부로 클립). Presentation 모드에서는 생략
    const showGrid = options.showGrid !== false;
    if (showGrid) {
    const gridGroup = new Konva.Group({
      clipFunc: (ctx) => {
        ctx.beginPath();
        ctx.moveTo(polygon[0].xMm, polygon[0].yMm);
        for (let i = 1; i < polygon.length; i++) ctx.lineTo(polygon[i].xMm, polygon[i].yMm);
        ctx.closePath();
      },
    });
    const startX = Math.ceil(minX / gridSizeMm) * gridSizeMm;
    const startY = Math.ceil(minY / gridSizeMm) * gridSizeMm;
    for (let x = startX; x <= maxX + 0.5; x += gridSizeMm) {
      gridGroup.add(
        new Konva.Line({
          points: [x, minY, x, maxY],
          stroke: CANVAS_COLORS.grid,
          strokeWidth: GRID_STROKE_PX,
          strokeScaleEnabled: false,
        }),
      );
    }
    for (let y = startY; y <= maxY + 0.5; y += gridSizeMm) {
      gridGroup.add(
        new Konva.Line({
          points: [minX, y, maxX, y],
          stroke: CANVAS_COLORS.grid,
          strokeWidth: GRID_STROKE_PX,
          strokeScaleEnabled: false,
        }),
      );
    }
    layer.add(gridGroup);
    }

    // 벽체: polygon 은 전체 외곽, rectangle 은 오픈면 기준 닫힌 변
    if (isPolygon) {
      layer.add(
        new Konva.Line({
          points: flattenPolygon(polygon),
          closed: true,
          stroke: CANVAS_COLORS.wall,
          strokeWidth: WALL_STROKE_PX,
          strokeScaleEnabled: false,
          lineJoin: 'round',
        }),
      );
    } else {
      const edges = getWallEdges(booth.openSide);
      // 벽별 색상 반영(미지정 시 기본색). top=후면, bottom=정면, left/right (v1.1.7)
      const addWall = (side: WallSide, points: number[]) =>
        layer.add(
          new Konva.Line({
            points,
            stroke: getWallColor(booth, side) ?? CANVAS_COLORS.wall,
            strokeWidth: WALL_STROKE_PX,
            strokeScaleEnabled: false,
            lineCap: 'square',
          }),
        );
      if (edges.top) addWall('backWall', [minX, minY, maxX, minY]);
      if (edges.right) addWall('rightWall', [maxX, minY, maxX, maxY]);
      if (edges.bottom) addWall('frontWall', [minX, maxY, maxX, maxY]);
      if (edges.left) addWall('leftWall', [minX, minY, minX, maxY]);
    }

    // SVG 배경 (맨 아래)
    for (const bg of backgrounds) {
      const node = buildImageNode(bg, imageElements);
      if (node) layer.add(node);
    }

    // 이미지 (집기 아래)
    for (const img of images) {
      const node = buildImageNode(img, imageElements);
      if (node) layer.add(node);
    }

    // 집기
    const designAssets = options.designAssets ?? [];
    for (const p of placed) {
      const def = fixturesById.get(p.fixtureDefId);
      if (!def) continue;
      let dm = planFaceMapping(p.design);
      let designImage = dm ? imageElements.get(assetById(designAssets, dm.assetId)?.url ?? '') : undefined;
      // 커스텀 이미지 집기(v1.1.1) — 인스턴스 디자인 없으면 customAsset 이미지 표시
      const ca = def.customAsset;
      if (!dm && ca?.kind === 'image' && ca.fileUrl && ca.display2d !== 'footprint') {
        dm = { assetId: '', mode: 'contain', transform: DEFAULT_TEXTURE_TRANSFORM };
        designImage = imageElements.get(ca.fileUrl);
      }
      layer.add(buildFixtureGroup(p, def, scale, showFixtureNames, dm, designImage, options.showDimensions !== false));
    }

    // 제품 (Product Layer, 집기 위) — v0.9.3
    const productsList = options.products ?? [];
    for (const pp of options.placedProducts ?? []) {
      const prod = findProduct(productsList, pp.productId);
      if (!prod) continue;
      const url = productImageUrl(prod, pp.facing);
      const img = url ? imageElements.get(url) : undefined;
      layer.add(buildProductGroup(pp, prod, scale, img));
    }

    // 텍스트
    for (const t of texts) {
      layer.add(buildTextLabel(t));
    }

    // 치수선 + 부스 치수 라벨. Presentation 모드에서는 생략
    // 사용자 치수선(주석)은 [치수] 토글과 무관하게 항상 출력 (화면과 동일)
    for (const d of dimensions) {
      layer.add(buildDimensionGroup(d, scale));
    }

    // 부스 외곽 치수(바운딩 박스 + 전체 크기 라벨) — [치수] 토글과 무관하게 항상 출력 (v1.2.0)
    {
      const labelFont = 24 / scale;
      layer.add(
        new Konva.Text({
          x: minX,
          y: maxY + 26 / scale,
          width: boothW,
          align: 'center',
          text: `${boothW} mm`,
          fontSize: labelFont,
          fill: CANVAS_COLORS.dimText,
        }),
      );
      layer.add(
        new Konva.Text({
          x: minX - 26 / scale,
          y: maxY,
          width: boothD,
          align: 'center',
          rotation: -90,
          offsetY: labelFont + 2 / scale,
          text: `${boothD} mm`,
          fontSize: labelFont,
          fill: CANVAS_COLORS.dimText,
        }),
      );
      // 부스 전체 크기 파란 라벨은 v1.2.2에서 제거 — 외곽 치수선 + 숫자만 유지(화면과 동일)
    }

    return stage.toDataURL({ pixelRatio: options.pixelRatio ?? 2 });
  } finally {
    stage.destroy();
    container.remove();
  }
}

/** 이미지 하나를 그리는 Konva.Image — 평면도/벽면 공용 (미리 로드된 요소 사용) */
export function buildImageNode(
  img: PlacedImage,
  imageElements: Map<string, HTMLImageElement>,
): Konva.Image | null {
  const el = imageElements.get(img.srcDataUrl);
  if (!el) return null;
  return new Konva.Image({
    image: el,
    x: img.xMm,
    y: img.yMm,
    width: img.widthMm,
    height: img.heightMm,
    rotation: img.rotationDeg,
    opacity: img.opacity,
  });
}

/** 텍스트 하나를 그리는 Konva.Label (배경 Tag + Text) — 평면도/벽면 공용 */
export function buildTextLabel(t: PlacedText): Konva.Label {
  const pad = Math.max(t.fontSizeMm * 0.15, 20);
  const label = new Konva.Label({ x: t.xMm, y: t.yMm, rotation: t.rotationDeg });
  label.add(new Konva.Tag({ fill: t.backgroundColor || undefined, cornerRadius: pad * 0.4 }));
  label.add(
    new Konva.Text({
      text: t.text || ' ',
      fontSize: t.fontSizeMm,
      fontFamily: TEXT_FONT_FAMILY,
      fontStyle: t.bold ? 'bold' : 'normal',
      fill: t.color,
      align: t.align,
      padding: pad,
    }),
  );
  return label;
}

/** 치수선 하나(선+화살표+라벨)를 그리는 Konva.Group — 평면도/벽면 공용 */
export function buildDimensionGroup(d: PlacedDimension, scale: number): Konva.Group {
  const group = new Konva.Group();
  group.add(
    new Konva.Arrow({
      points: [d.startXMm, d.startYMm, d.endXMm, d.endYMm],
      stroke: d.color,
      fill: d.color,
      strokeWidth: d.lineWidthPx,
      strokeScaleEnabled: false,
      pointerAtBeginning: d.showArrows,
      pointerAtEnding: d.showArrows,
      pointerLength: 22 / scale,
      pointerWidth: 16 / scale,
    }),
  );

  // 라벨: 왼→오른쪽으로 읽히도록 정규화
  let ax = d.startXMm, ay = d.startYMm, bx = d.endXMm, by = d.endYMm;
  let ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  if (ang > 90 || ang < -90) {
    [ax, bx] = [bx, ax];
    [ay, by] = [by, ay];
    ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
  }
  const length = Math.hypot(bx - ax, by - ay);
  if (length >= 1) {
    const fontMm = 15 / scale;
    group.add(
      new Konva.Text({
        text: dimensionDisplayLabel(d),
        x: ax,
        y: ay,
        rotation: ang,
        width: length,
        align: 'center',
        offsetY: fontMm * 1.4,
        fontSize: fontMm,
        fontFamily: DIMENSION_FONT_FAMILY,
        fill: d.textColor,
      }),
    );
  }
  return group;
}

/** placeholder(반투명 + 대각선 + 점선 테두리) — 실제 형태가 없는 경우 */
function addPlaceholder(group: Konva.Group, color: string, w: number, d: number): void {
  group.add(new Konva.Rect({ width: w, height: d, fill: color, opacity: 0.3 }));
  group.add(new Konva.Line({ points: [0, 0, w, d], stroke: color, strokeWidth: 1, strokeScaleEnabled: false }));
  group.add(new Konva.Line({ points: [w, 0, 0, d], stroke: color, strokeWidth: 1, strokeScaleEnabled: false }));
  group.add(
    new Konva.Rect({
      width: w,
      height: d,
      stroke: color,
      dash: [10, 6],
      strokeWidth: 1.5,
      strokeScaleEnabled: false,
    }),
  );
}

/** 배치 집기 하나를 그리는 Konva.Group (형태별) + 이름 라벨(옵션) */
function buildFixtureGroup(
  p: PlacedFixture,
  def: FixtureDef,
  scale: number,
  showName: boolean,
  designMapping?: FaceMapping | null,
  designImage?: HTMLImageElement,
  showDimensions = true,
): Konva.Group {
  const group = new Konva.Group({ x: p.xMm, y: p.yMm, rotation: p.rotationDeg });
  const w = def.widthMm;
  const d = def.depthMm;
  const outline = 'rgba(0,0,0,0.35)';
  const common = { stroke: outline, strokeWidth: 1, strokeScaleEnabled: false };
  const fill = fillColor(def.color, def.opacity); // opacity 반영

  switch (def.shape) {
    case 'rectangle':
      group.add(new Konva.Rect({ width: w, height: d, fill, ...common }));
      break;
    case 'roundedRectangle':
      group.add(
        new Konva.Rect({
          width: w,
          height: d,
          fill,
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
          fill,
          ...common,
        }),
      );
      break;
    case 'customPath':
      if (def.svgPath) {
        group.add(
          new Konva.Path({
            data: def.svgPath,
            scaleX: w / CUSTOM_PATH_VIEW,
            scaleY: d / CUSTOM_PATH_VIEW,
            fill,
            ...common,
          }),
        );
      } else {
        addPlaceholder(group, fill, w, d);
      }
      break;
    default:
      // semicircle (및 path 없는 customPath): placeholder
      addPlaceholder(group, fill, w, d);
      break;
  }

  // 디자인 텍스처 (v0.8.7) — 집기 영역에 클립하여 매핑/변형/투명도 적용
  if (designMapping && designImage) {
    addDesignTexture(group, designMapping, designImage, w, d);
  }

  // 이름 라벨 (v1.1.8, #6) — 집기 "위쪽"(상단 바깥). 어떤 배경색에서도 읽히도록 흰 글자 + 어두운 외곽선.
  if (showName && def.name) {
    const nameFont = 20 / scale;
    group.add(
      new Konva.Text({
        x: 0,
        y: -nameFont * 1.35,
        width: w,
        align: 'center',
        wrap: 'none',
        ellipsis: true,
        text: def.name,
        fontSize: nameFont,
        fontStyle: 'bold',
        fill: '#ffffff',
        stroke: 'rgba(0,0,0,0.65)',
        strokeWidth: 2 / scale,
        fillAfterStrokeEnabled: true,
        listening: false,
      }),
    );
  }

  // 사이즈 라벨 (v1.1.8, #6) — 집기 "아래쪽"(하단 바깥), 파란 통일 라벨.
  if (showDimensions) {
    const sizeFont = 15 / scale;
    const text = `${Math.round(w)}×${Math.round(d)}`;
    const tw = new Konva.Text({ text, fontSize: sizeFont, fontStyle: 'bold' }).width();
    const padX = sizeFont * 0.5;
    const padY = sizeFont * 0.3;
    const bgW = tw + padX * 2;
    const bgH = sizeFont + padY * 2;
    const gap = sizeFont * 0.4;
    group.add(
      new Konva.Rect({
        x: w / 2 - bgW / 2,
        y: d + gap,
        width: bgW,
        height: bgH,
        fill: '#2563eb',
        cornerRadius: sizeFont * 0.32,
      }),
    );
    group.add(
      new Konva.Text({
        x: w / 2 - tw / 2,
        y: d + gap + padY,
        text,
        fontSize: sizeFont,
        fontStyle: 'bold',
        fill: '#ffffff',
        listening: false,
      }),
    );
  }

  return group;
}

/** 배치 제품 그룹 (Product Layer export, v0.9.3) */
function buildProductGroup(pp: PlacedProduct, prod: Product, scale: number, img?: HTMLImageElement): Konva.Group {
  const { w, d } = productSize(prod, pp);
  const group = new Konva.Group({ x: pp.xMm, y: pp.yMm, rotation: pp.rotationDeg });
  if (img) {
    group.add(new Konva.Image({ image: img, width: w, height: d }));
  } else {
    group.add(
      new Konva.Rect({
        width: w,
        height: d,
        fill: prod.displayColor || DEFAULT_PRODUCT_COLOR,
        cornerRadius: Math.min(w, d) * 0.08,
        stroke: 'rgba(0,0,0,0.3)',
        strokeWidth: 1,
        strokeScaleEnabled: false,
      }),
    );
  }
  if (w * scale >= 30 && prod.name) {
    group.add(
      new Konva.Text({
        width: w,
        height: d,
        align: 'center',
        verticalAlign: 'middle',
        wrap: 'none',
        ellipsis: true,
        text: prod.name,
        fontSize: 11 / scale,
        fill: '#111827',
        stroke: 'rgba(255,255,255,0.85)',
        strokeWidth: 2 / scale,
        fillAfterStrokeEnabled: true,
        listening: false,
        padding: 2,
      }),
    );
  }
  return group;
}

/** 집기 그룹에 디자인 텍스처를 추가 (DesignTextureNode 의 export 판; w×d 로 클립) */
function addDesignTexture(
  group: Konva.Group,
  mapping: FaceMapping,
  image: HTMLImageElement,
  w: number,
  d: number,
): void {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  const t = mapping.transform;
  const clip = new Konva.Group({
    listening: false,
    clipFunc: (ctx) => {
      ctx.beginPath();
      ctx.rect(0, 0, w, d);
      ctx.closePath();
    },
  });

  if (mapping.mode === 'tile') {
    const base = iw > 0 ? w / iw / 3 : 1;
    clip.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: d,
        fillPatternImage: image,
        fillPatternRepeat: 'repeat',
        fillPatternScaleX: base * t.scale * (t.flipH ? -1 : 1),
        fillPatternScaleY: base * t.scale * (t.flipV ? -1 : 1),
        fillPatternRotation: t.rotationDeg,
        fillPatternOffsetX: -t.offsetX * w,
        fillPatternOffsetY: -t.offsetY * d,
        opacity: t.opacity,
        listening: false,
      }),
    );
  } else {
    const { dw, dh } = computeFitRect(iw, ih, w, d, mapping.mode);
    const sdw = dw * t.scale;
    const sdh = dh * t.scale;
    clip.add(
      new Konva.Image({
        image,
        width: sdw,
        height: sdh,
        offsetX: sdw / 2,
        offsetY: sdh / 2,
        x: w / 2 + t.offsetX * w,
        y: d / 2 + t.offsetY * d,
        rotation: t.rotationDeg,
        scaleX: t.flipH ? -1 : 1,
        scaleY: t.flipV ? -1 : 1,
        opacity: t.opacity,
        listening: false,
      }),
    );
  }
  group.add(clip);
}

import type {
  BoothConfig,
  BoxFace,
  DesignAsset,
  FaceMapping,
  FixtureDef,
  PlacedDimension,
  PlacedFixture,
  PlacedImage,
  PlacedProduct,
  PlacedText,
  Product,
  WallItems,
  WallSide,
} from '../../types';
import { getBoothPolygon, getBoothBounds } from '../canvas/boothGeometry';
import { getFixtureCorners } from '../canvas/fixtureGeometry';
import { generateGeometry } from './geometry/GeometryGenerator';
import { isWallEnabled } from '../wall/constants';
import { planFaceMapping, resolveFaceMapping, assetById } from '../design/mapping';
import { productImageUrl } from '../products/productModel';
import { productRenderGeo, productMaterialToFixture } from '../products/productGeometry';

/**
 * 아이소메트릭 3D 씬 데이터 (렌더러 비의존, mm 좌표).
 *
 * 이 구조는 순수 3D 기하 정보만 담아, 추후 Three.js 로 옮길 때
 * 그대로 메쉬(바닥 평면 / 벽 평면 / 집기 박스 / 이미지 평면)로 매핑할 수 있습니다.
 * 현재는 2D 아이소메트릭 렌더러(renderIso.ts)가 소비합니다.
 */

export interface V3 {
  x: number;
  y: number;
  z: number;
}

/** 벽 평면 하나 (바닥선 baseStart→baseEnd 를 heightMm 만큼 세움) */
export interface IsoWall {
  side: WallSide;
  baseStart: V3; // 벽 로컬 u=0, z=0
  baseEnd: V3; // 벽 로컬 u=wallLengthMm, z=0
  wallLengthMm: number;
  heightMm: number;
  /** 시점 기준 바깥 노멀의 (nx+ny). <0 이면 뒷벽(불투명), >0 이면 앞벽(반투명) */
  facingSum: number;
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  images: PlacedImage[];
}

/** 집기 면 텍스처 (디자인 매핑, v0.8.7) */
export interface IsoFaceTexture {
  url: string;
  opacity: number;
  /** 좌우 반전 렌더 (v1.0.4) — VMD 정면 카드 라벨이 뒤집히지 않도록 */
  flipH?: boolean;
  /** 면 내 배치(레이어, v1.0.6). 미지정 시 면 전체. scale 1=면 전체, offset -1~1 */
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

/** 집기 프리즘 (바닥 footprint 폴리곤 + 높이 extrude) */
export interface IsoBox {
  footprint: V3[]; // z=0 외곽선 (Shape 별 다각형)
  heightMm: number;
  color: string;
  /** 채움 투명도 0~1 (v0.8.5) */
  opacity: number;
  name: string;
  /** 면별 디자인 텍스처 (v0.8.7). top + front/back/left/right — base(맨 아래) 레이어 */
  faces?: Partial<Record<'top' | BoxFace, IsoFaceTexture>>;
  /** 면별 추가 레이어 (v1.0.6). base 위에 순서대로 겹쳐 렌더 */
  faceOverlays?: Partial<Record<'top' | BoxFace, IsoFaceTexture[]>>;
  /**
   * 윗면 텍스처 매핑 프레임 (v1.0.7) — 집기의 방향성 바운딩 사각형 4점 [TL,TR,BR,BL] (z=0).
   * 곡면/customPath 처럼 footprint 점이 많은 경우, 윗면 이미지를 이 사각형에 매핑해 정상 출력.
   * 미지정 시 footprint 상단 폴리곤의 앞 3점을 사용(사각형은 동일).
   */
  topFrame?: V3[];
  /** 곡면(라운드/원기둥/커스텀) — 측면 텍스처를 둘레 UV wrap 으로 처리 (v0.9.1) */
  curved?: boolean;
  /** 곡면 측면 wrap 용 텍스처 (v0.9.1) */
  wrapTexture?: IsoFaceTexture;
  /** 3D 재질 (v0.9.2) */
  material?: import('../../types').FixtureMaterial;
  /** 바닥 기준 시작 높이(mm). 제품은 집기 상판 높이에서 시작 (v0.9.4) */
  baseZmm?: number;
}

/** 바닥 위 이미지 (z=0 평면) */
export interface IsoFloorImage {
  image: PlacedImage;
}

export interface IsoScene {
  floorPolygon: V3[]; // 바닥(부스 polygon) z=0
  walls: IsoWall[];
  boxes: IsoBox[];
  floorImages: IsoFloorImage[];
}

/** 실무 시안(Practical Render) 추가 요소 (v1.0.0-pre) */
export interface RenderExtras {
  /** 사람 실루엣(스케일용) 추가 */
  humanSilhouette?: boolean;
  /** 바닥 매트 추가 */
  floorMat?: boolean;
  /** 제품 이미지 숨김(단색 박스로 표시) */
  hideProductImages?: boolean;
}

/** 집기 기본 높이 (heightMm 미지정 시) */
export const DEFAULT_FIXTURE_HEIGHT_MM = 1000;
/** 집기 높이 clamp 범위 (너무 낮거나 높은 값 보정) */
const MIN_FIXTURE_HEIGHT_MM = 200;
const MAX_FIXTURE_HEIGHT_MM = 3500;

/** 집기 높이를 실제값 기준으로 clamp. 부스 높이가 있으면 그 이하로 제한 */
function resolveFixtureHeight(rawHeightMm: number | null | undefined, boothHeightMm: number | null): number {
  const raw = rawHeightMm ?? DEFAULT_FIXTURE_HEIGHT_MM;
  const upper = boothHeightMm && boothHeightMm > 0
    ? Math.min(MAX_FIXTURE_HEIGHT_MM, boothHeightMm)
    : MAX_FIXTURE_HEIGHT_MM;
  return Math.max(MIN_FIXTURE_HEIGHT_MM, Math.min(upper, raw));
}

/** 벽 4면(bbox 기준) 정의 */
function buildWalls(booth: BoothConfig, wallItems: WallItems): IsoWall[] {
  const b = getBoothBounds(booth);
  const h = booth.heightMm ?? 0;
  const v = (x: number, y: number): V3 => ({ x, y, z: 0 });

  const defs: { side: WallSide; start: V3; end: V3; len: number; facingSum: number }[] = [
    { side: 'backWall', start: v(b.minX, b.minY), end: v(b.maxX, b.minY), len: b.widthMm, facingSum: -1 },
    { side: 'frontWall', start: v(b.minX, b.maxY), end: v(b.maxX, b.maxY), len: b.widthMm, facingSum: +1 },
    { side: 'leftWall', start: v(b.minX, b.minY), end: v(b.minX, b.maxY), len: b.depthMm, facingSum: -1 },
    { side: 'rightWall', start: v(b.maxX, b.minY), end: v(b.maxX, b.maxY), len: b.depthMm, facingSum: +1 },
  ];

  return defs
    .filter((d) => isWallEnabled(booth, d.side)) // OFF 벽면은 3D 에서 제외
    .map((d) => ({
      side: d.side,
      baseStart: d.start,
      baseEnd: d.end,
      wallLengthMm: d.len,
      heightMm: h,
      facingSum: d.facingSum,
      texts: wallItems[d.side].texts,
      dimensions: wallItems[d.side].dimensions,
      images: wallItems[d.side].images,
    }));
}

/** 배치 데이터로부터 아이소메트릭 3D 씬을 구성 */
export function buildIsoScene(
  booth: BoothConfig,
  placed: PlacedFixture[],
  fixturesById: Map<string, FixtureDef>,
  planImages: PlacedImage[],
  wallItems: WallItems,
  designAssets: DesignAsset[] = [],
  placedProducts: PlacedProduct[] = [],
  products: Product[] = [],
  extras: RenderExtras = {},
): IsoScene {
  const floorPolygon: V3[] = getBoothPolygon(booth).map((p) => ({ x: p.xMm, y: p.yMm, z: 0 }));

  const boxes: IsoBox[] = [];
  for (const p of placed) {
    const def = fixturesById.get(p.fixtureDefId);
    if (!def) continue;
    // 2D Shape → 3D extrude 지오메트리
    const geo = generateGeometry(p, def);
    // 면별 디자인 텍스처 해석 (base + 추가 레이어 overlays, v1.0.6)
    let faces: IsoBox['faces'];
    let faceOverlays: IsoBox['faceOverlays'];
    let wrapTexture: IsoFaceTexture | undefined;
    if (p.design) {
      const design = p.design;
      const toTex = (m: FaceMapping): IsoFaceTexture | null => {
        const a = assetById(designAssets, m.assetId);
        if (!a) return null;
        const t = m.transform;
        return { url: a.url, opacity: t.opacity, flipH: t.flipH, scale: t.scale, offsetX: t.offsetX, offsetY: t.offsetY };
      };
      const overlaysFor = (face: BoxFace): FaceMapping[] =>
        (design.applyAll ? design.overlays?.front : design.overlays?.[face]) ?? [];
      const f: NonNullable<IsoBox['faces']> = {};
      const fov: NonNullable<IsoBox['faceOverlays']> = {};
      const buildFace = (key: 'top' | BoxFace, base: FaceMapping | null, ovFace: BoxFace) => {
        const bt = base ? toTex(base) : null;
        if (bt) f[key] = bt;
        const ovs = overlaysFor(ovFace).map(toTex).filter((x): x is IsoFaceTexture => !!x);
        if (ovs.length) fov[key] = ovs;
      };
      buildFace('top', planFaceMapping(design), 'top');
      for (const side of ['front', 'back', 'left', 'right'] as BoxFace[]) buildFace(side, resolveFaceMapping(design, side), side);
      if (Object.keys(f).length > 0) faces = f;
      if (Object.keys(fov).length > 0) faceOverlays = fov;
      // 곡면 측면 wrap: 대표 면(front/applyAll/첫 면) 텍스처를 둘레에 감쌈
      if (geo.curved) {
        const wm = resolveFaceMapping(design, 'front');
        const wt = wm ? toTex(wm) : null;
        if (wt) wrapTexture = wt;
      }
    }
    boxes.push({
      footprint: geo.footprint.map((c) => ({ x: c.xMm, y: c.yMm, z: 0 })),
      heightMm: resolveFixtureHeight(def.heightMm, booth.heightMm),
      color: def.color,
      opacity: def.opacity ?? 1,
      name: def.name,
      faces,
      faceOverlays,
      // 윗면 이미지 매핑용 방향성 사각형(곡면/customPath 상단 매핑 정상화, v1.0.7)
      topFrame: getFixtureCorners(p, def).map((c) => ({ x: c.xMm, y: c.yMm, z: 0 })),
      curved: geo.curved,
      wrapTexture,
      material: def.material,
    });
  }

  // --- 배치 제품 (Digital Merchandising, v0.9.3~v0.9.4) — 집기 Display Surface 위에 실제처럼 올라감 ---
  const productById = new Map(products.map((p) => [p.id, p]));
  const placedFixtureById = new Map(placed.map((f) => [f.id, f]));
  for (const pp of placedProducts) {
    const prod = productById.get(pp.productId);
    if (!prod) continue;
    // 소속 집기의 상판 높이(Display Surface) — 제품은 항상 이 높이에서 시작 (바닥 아님, §1)
    // 집기가 없거나(미연결) 높이 미지정이면 기본 상판 높이(900)로 가정해 바닥에 떨어지지 않게 함.
    const pf = pp.fixtureId ? placedFixtureById.get(pp.fixtureId) : undefined;
    const fdef = pf ? fixturesById.get(pf.fixtureDefId) : undefined;
    const baseZ = fdef ? Math.max(0, fdef.heightMm ?? 900) : pf ? 900 : 0;
    const w = prod.widthMm * pp.scale;
    const d = prod.depthMm * pp.scale;
    const h = Math.max(30, (prod.heightMm ?? 300) * pp.scale);
    const rad = (pp.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // 제품 렌더 모드 지오메트리 (Standing Card 기본, v1.0.0-pre)
    const geo = productRenderGeo(prod, w, d, h);
    const footprint: V3[] = geo.polygon.map(({ lx, ly }) => ({
      x: pp.xMm + lx * cos - ly * sin,
      y: pp.yMm + lx * sin + ly * cos,
      z: baseZ,
    }));
    const img = extras.hideProductImages ? undefined : productImageUrl(prod, pp.facing);
    // 배경 투명(transparent) 이면 이미지의 alpha 를 유지(흰 배경 만들지 않음, §3)
    const transparent = prod.backgroundMode === 'transparent';
    let faces: IsoBox['faces'];
    let wrapTexture: IsoFaceTexture | undefined;
    if (img) {
      if (geo.imageFaces === 'wrap') {
        wrapTexture = { url: img, opacity: 1 };
        faces = { top: { url: img, opacity: 1 } };
      } else if (geo.imageFaces === 'top') {
        faces = { top: { url: img, opacity: 1 } };
      } else if (geo.imageFaces === 'frontBack') {
        // Standing Card: 정면/후면(넓은 면)에 PNG
        faces = { front: { url: img, opacity: 1 }, back: { url: img, opacity: 1 } };
      } else {
        faces = { top: { url: img, opacity: 1 }, front: { url: img, opacity: 1 }, back: { url: img, opacity: 1 }, left: { url: img, opacity: 1 }, right: { url: img, opacity: 1 } };
      }
    }
    boxes.push({
      footprint,
      heightMm: geo.heightMm,
      baseZmm: baseZ,
      // 투명 배경이면 박스 채움 없이 이미지(PNG alpha)만 표시(흰 배경 만들지 않음, §3)
      color: prod.displayColor ?? '#f59e0b',
      opacity: transparent && img ? 0 : 1,
      name: prod.name,
      faces,
      curved: geo.curved,
      wrapTexture,
      material: productMaterialToFixture(prod.material),
    });
  }

  // --- 실무 시안 추가 요소 (Practical Render, v1.0.0-pre) ---
  const b = getBoothBounds(booth);
  if (extras.floorMat) {
    // 부스 안쪽에 얇은 매트(높이 8mm) — 바닥에 깔린 매트 느낌
    const inset = Math.min(b.widthMm, b.depthMm) * 0.12;
    const mx0 = b.minX + inset;
    const my0 = b.minY + inset;
    const mx1 = b.maxX - inset;
    const my1 = b.maxY - inset;
    boxes.unshift({
      footprint: [
        { x: mx0, y: my0, z: 0 },
        { x: mx1, y: my0, z: 0 },
        { x: mx1, y: my1, z: 0 },
        { x: mx0, y: my1, z: 0 },
      ],
      heightMm: 8,
      color: '#d9dee6',
      opacity: 1,
      name: '',
      material: 'matte',
    });
  }
  if (extras.humanSilhouette) {
    // 스케일용 사람 실루엣(얇은 세움 카드, 1700mm) — 부스 앞쪽 좌측
    const hw = 450;
    const hd = 180;
    const hx = b.minX + Math.min(700, b.widthMm * 0.15);
    const hy = b.maxY - hd - Math.min(500, b.depthMm * 0.12);
    boxes.push({
      footprint: [
        { x: hx, y: hy, z: 0 },
        { x: hx + hw, y: hy, z: 0 },
        { x: hx + hw, y: hy + hd, z: 0 },
        { x: hx, y: hy + hd, z: 0 },
      ],
      heightMm: 1700,
      color: '#94a3b8',
      opacity: 0.9,
      name: '',
      material: 'matte',
    });
  }

  return {
    floorPolygon,
    walls: buildWalls(booth, wallItems),
    boxes,
    floorImages: planImages.map((image) => ({ image })),
  };
}

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
import { getBoothOutline, getBoothBounds } from '../canvas/boothGeometry';
import { getFixtureCorners } from '../canvas/fixtureGeometry';
import { generateGeometry } from './geometry/GeometryGenerator';
import { isWallEnabled } from '../wall/constants';
import { layersForFace, assetById } from '../design/mapping';
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
  /**
   * 사이즈 표기용 실측 치수(mm) — 실무시안 치수 표기 옵션 (v1.0.8).
   * 실제 집기에만 설정(제품/매트/사람 등은 미설정).
   */
  dims?: { wMm: number; dMm: number; hMm: number };
}

/** 스케일 참고용 사람 실루엣 (v1.0.8) — 부스 바깥쪽에 세워 크기 비교 */
export interface IsoHuman {
  /** 발 위치(바닥 z=0) */
  x: number;
  y: number;
  heightMm: number;
}

/** 커스텀 3D 모델(GLB/GLTF) 집기 (v1.1.5) — Three.js 스프라이트로 렌더, 실패 시 placeholder */
export interface IsoModel {
  /** 배치 인스턴스 id (스프라이트 매핑용) */
  id: string;
  /** 집기 정의 id (모델 캐시/URL 조회) */
  defId: string;
  /** Storage 다운로드 URL (없으면 로컬 캐시만) */
  url?: string;
  footprint: V3[];
  cx: number;
  cy: number;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  rotationDeg: number;
  name: string;
  /** placeholder(로드 실패) 색 */
  color: string;
}

/**
 * 커스텀 이미지 집기의 세운 이미지 판넬/빌보드 (v1.1.4).
 * 회색 박스 대신 바닥에 세운 평면 이미지로 렌더(투명 PNG alpha 유지).
 */
export interface IsoPanel {
  /** 집기 중심(바닥, mm) */
  cx: number;
  cy: number;
  /** 판넬 가로축 단위벡터(집기 회전 반영). billboard 면 렌더 시 카메라 기준으로 대체됨 */
  wdx: number;
  wdy: number;
  widthMm: number;
  heightMm: number;
  /** 접지 그림자·fit 용 실제 footprint(회전 반영) */
  footprint: V3[];
  /** true 면 항상 카메라를 향함(빌보드), false 면 집기 방향 고정(판넬) */
  billboard: boolean;
  url: string;
  name: string;
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
  /** 스케일 참고용 사람 실루엣 (v1.0.8) */
  humans?: IsoHuman[];
  /** 커스텀 이미지 판넬/빌보드 (v1.1.4) */
  panels?: IsoPanel[];
  /** 커스텀 3D 모델 (v1.1.5) */
  models?: IsoModel[];
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
  // 바닥은 곡선(변별 bulge)을 반영한 외곽선으로 (v1.0.9). 곡선 없으면 기존과 동일.
  const floorPolygon: V3[] = getBoothOutline(booth).map((p) => ({ x: p.xMm, y: p.yMm, z: 0 }));

  const boxes: IsoBox[] = [];
  const panels: IsoPanel[] = [];
  const models: IsoModel[] = [];
  for (const p of placed) {
    const def = fixturesById.get(p.fixtureDefId);
    if (!def) continue;

    const ca = def.customAsset;

    // --- 커스텀 3D 모델 집기 → Three.js 스프라이트로 렌더 (v1.1.5). 실패 시 placeholder ---
    if (ca?.kind === 'model') {
      const corners = getFixtureCorners(p, def);
      const cx = corners.reduce((s, c) => s + c.xMm, 0) / corners.length;
      const cy = corners.reduce((s, c) => s + c.yMm, 0) / corners.length;
      models.push({
        id: p.id,
        defId: def.id,
        url: ca.fileUrl,
        footprint: corners.map((c) => ({ x: c.xMm, y: c.yMm, z: 0 })),
        cx,
        cy,
        widthMm: def.widthMm,
        depthMm: def.depthMm,
        heightMm: resolveFixtureHeight(def.heightMm, booth.heightMm),
        rotationDeg: p.rotationDeg,
        name: def.name,
        color: def.color,
      });
      continue;
    }

    // --- 커스텀 이미지 집기: panel/billboard(및 미지정 fallback) → 세운 이미지 판넬 (v1.1.4) ---
    // display3d 가 box-texture/top-texture 인 경우만 기존 박스 텍스처 방식 유지.
    if (!p.design && ca?.kind === 'image' && ca.fileUrl && ca.display3d !== 'box-texture' && ca.display3d !== 'top-texture') {
      const corners = getFixtureCorners(p, def);
      const cx = corners.reduce((s, c) => s + c.xMm, 0) / corners.length;
      const cy = corners.reduce((s, c) => s + c.yMm, 0) / corners.length;
      let wdx = corners[1].xMm - corners[0].xMm;
      let wdy = corners[1].yMm - corners[0].yMm;
      const wl = Math.hypot(wdx, wdy) || 1;
      wdx /= wl;
      wdy /= wl;
      panels.push({
        cx,
        cy,
        wdx,
        wdy,
        widthMm: def.widthMm,
        heightMm: resolveFixtureHeight(def.heightMm, booth.heightMm),
        footprint: corners.map((c) => ({ x: c.xMm, y: c.yMm, z: 0 })),
        billboard: ca.display3d === 'billboard',
        url: ca.fileUrl,
        name: def.name,
      });
      continue; // 회색 박스 대신 판넬만 렌더
    }

    // 2D Shape → 3D extrude 지오메트리
    const geo = generateGeometry(p, def);
    // 면별 디자인 텍스처 해석 — 레이어별 적용 면(faces) 반영 (base + overlays, v1.0.9)
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
      const f: NonNullable<IsoBox['faces']> = {};
      const fov: NonNullable<IsoBox['faceOverlays']> = {};
      // 면별로 렌더할 레이어 스택(아래→위)을 layersForFace 로 수집 → base + overlays 로 분리
      const buildFace = (key: 'top' | BoxFace) => {
        const layers = layersForFace(design, key).map(toTex).filter((x): x is IsoFaceTexture => !!x);
        if (layers.length === 0) return;
        f[key] = layers[0];
        if (layers.length > 1) fov[key] = layers.slice(1);
      };
      (['top', 'front', 'back', 'left', 'right'] as const).forEach(buildFace);
      if (Object.keys(f).length > 0) faces = f;
      if (Object.keys(fov).length > 0) faceOverlays = fov;
      // 곡면 측면 wrap: 정면 최상단 레이어를 둘레에 감쌈
      if (geo.curved) {
        const wl = layersForFace(design, 'front');
        const wt = wl.length ? toTex(wl[wl.length - 1]) : null;
        if (wt) wrapTexture = wt;
      }
    } else if (def.customAsset?.kind === 'image' && def.customAsset.fileUrl) {
      // 커스텀 이미지 집기(v1.1.1) — display3d 에 따라 면 텍스처 합성 (인스턴스 디자인 없을 때)
      const url = def.customAsset.fileUrl;
      const tex: IsoFaceTexture = { url, opacity: 1 };
      const f: NonNullable<IsoBox['faces']> = {};
      switch (def.customAsset.display3d) {
        case 'box-texture':
          f.front = tex; f.back = tex; f.left = tex; f.right = tex; f.top = tex;
          break;
        case 'top-texture':
          f.top = tex;
          break;
        case 'billboard':
          f.front = tex;
          break;
        case 'panel':
        default:
          f.front = tex; f.back = tex;
          break;
      }
      if (Object.keys(f).length > 0) faces = f;
    }
    const fxHeight = resolveFixtureHeight(def.heightMm, booth.heightMm);
    boxes.push({
      footprint: geo.footprint.map((c) => ({ x: c.xMm, y: c.yMm, z: 0 })),
      heightMm: fxHeight,
      color: def.color,
      opacity: def.opacity ?? 1,
      name: def.name,
      // 사이즈 표기용 실측 치수(실무시안 치수 옵션, v1.0.8)
      dims: { wMm: def.widthMm, dMm: def.depthMm, hMm: def.heightMm ?? fxHeight },
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
  // 스케일용 사람 실루엣(머리+몸통) — 부스 바깥쪽(앞쪽) 에 세워 크기 비교 (v1.0.8)
  const humans: IsoHuman[] = [];
  if (extras.humanSilhouette) {
    const gap = Math.max(400, b.depthMm * 0.12); // 부스 앞면(maxY) 바깥으로 이격
    humans.push({ x: b.minX + b.widthMm * 0.28, y: b.maxY + gap, heightMm: 1700 });
    humans.push({ x: b.minX + b.widthMm * 0.72, y: b.maxY + gap + 250, heightMm: 1650 });
  }

  return {
    floorPolygon,
    walls: buildWalls(booth, wallItems),
    boxes,
    floorImages: planImages.map((image) => ({ image })),
    humans,
    panels,
    models,
  };
}

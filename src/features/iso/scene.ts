import type {
  BoothConfig,
  BoxFace,
  DesignAsset,
  FixtureDef,
  PlacedDimension,
  PlacedFixture,
  PlacedImage,
  PlacedText,
  WallItems,
  WallSide,
} from '../../types';
import { getBoothPolygon, getBoothBounds } from '../canvas/boothGeometry';
import { generateGeometry } from './geometry/GeometryGenerator';
import { isWallEnabled } from '../wall/constants';
import { planFaceMapping, resolveFaceMapping, assetById } from '../design/mapping';

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
}

/** 집기 프리즘 (바닥 footprint 폴리곤 + 높이 extrude) */
export interface IsoBox {
  footprint: V3[]; // z=0 외곽선 (Shape 별 다각형)
  heightMm: number;
  color: string;
  /** 채움 투명도 0~1 (v0.8.5) */
  opacity: number;
  name: string;
  /** 면별 디자인 텍스처 (v0.8.7). top + front/back/left/right */
  faces?: Partial<Record<'top' | BoxFace, IsoFaceTexture>>;
  /** 곡면(라운드/원기둥/커스텀) — 측면 텍스처를 둘레 UV wrap 으로 처리 (v0.9.1) */
  curved?: boolean;
  /** 곡면 측면 wrap 용 텍스처 (v0.9.1) */
  wrapTexture?: IsoFaceTexture;
  /** 3D 재질 (v0.9.2) */
  material?: import('../../types').FixtureMaterial;
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
): IsoScene {
  const floorPolygon: V3[] = getBoothPolygon(booth).map((p) => ({ x: p.xMm, y: p.yMm, z: 0 }));

  const boxes: IsoBox[] = [];
  for (const p of placed) {
    const def = fixturesById.get(p.fixtureDefId);
    if (!def) continue;
    // 2D Shape → 3D extrude 지오메트리
    const geo = generateGeometry(p, def);
    // 면별 디자인 텍스처 해석
    let faces: IsoBox['faces'];
    let wrapTexture: IsoFaceTexture | undefined;
    if (p.design) {
      const f: NonNullable<IsoBox['faces']> = {};
      const top = planFaceMapping(p.design);
      const topAsset = top ? assetById(designAssets, top.assetId) : null;
      if (top && topAsset) f.top = { url: topAsset.url, opacity: top.transform.opacity };
      for (const side of ['front', 'back', 'left', 'right'] as BoxFace[]) {
        const m = resolveFaceMapping(p.design, side);
        const a = m ? assetById(designAssets, m.assetId) : null;
        if (m && a) f[side] = { url: a.url, opacity: m.transform.opacity };
      }
      if (Object.keys(f).length > 0) faces = f;
      // 곡면 측면 wrap: 대표 면(front/applyAll/첫 면) 텍스처를 둘레에 감쌈
      if (geo.curved) {
        const wm = resolveFaceMapping(p.design, 'front');
        const wa = wm ? assetById(designAssets, wm.assetId) : null;
        if (wm && wa) wrapTexture = { url: wa.url, opacity: wm.transform.opacity };
      }
    }
    boxes.push({
      footprint: geo.footprint.map((c) => ({ x: c.xMm, y: c.yMm, z: 0 })),
      heightMm: resolveFixtureHeight(def.heightMm, booth.heightMm),
      color: def.color,
      opacity: def.opacity ?? 1,
      name: def.name,
      faces,
      curved: geo.curved,
      wrapTexture,
      material: def.material,
    });
  }

  return {
    floorPolygon,
    walls: buildWalls(booth, wallItems),
    boxes,
    floorImages: planImages.map((image) => ({ image })),
  };
}

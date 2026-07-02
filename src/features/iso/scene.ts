import type {
  BoothConfig,
  FixtureDef,
  PlacedDimension,
  PlacedFixture,
  PlacedImage,
  PlacedText,
  WallItems,
  WallSide,
} from '../../types';
import { getBoothPolygon, getBoothBounds } from '../canvas/boothGeometry';
import { getFixtureCorners } from '../canvas/fixtureGeometry';

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

/** 집기 박스 (바닥 footprint 4점 + 높이) */
export interface IsoBox {
  footprint: V3[]; // z=0 4점
  heightMm: number;
  color: string;
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

  return defs.map((d) => ({
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
): IsoScene {
  const floorPolygon: V3[] = getBoothPolygon(booth).map((p) => ({ x: p.xMm, y: p.yMm, z: 0 }));

  const boxes: IsoBox[] = [];
  for (const p of placed) {
    const def = fixturesById.get(p.fixtureDefId);
    if (!def) continue;
    boxes.push({
      footprint: getFixtureCorners(p, def).map((c) => ({ x: c.xMm, y: c.yMm, z: 0 })),
      heightMm: resolveFixtureHeight(def.heightMm, booth.heightMm),
      color: def.color,
      name: def.name,
    });
  }

  return {
    floorPolygon,
    walls: buildWalls(booth, wallItems),
    boxes,
    floorImages: planImages.map((image) => ({ image })),
  };
}

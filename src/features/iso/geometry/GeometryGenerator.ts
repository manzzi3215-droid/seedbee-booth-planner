import type { FixtureDef, FixtureShape, PlacedFixture, PointMm } from '../../../types';
import { getFixtureCorners } from '../../canvas/fixtureGeometry';
import { CUSTOM_PATH_VIEW } from '../../fixtures/shapes';

/**
 * Geometry Generator (v0.9.1) — 2D Shape → 3D Extrude 지오메트리 파이프라인.
 *
 * 각 Shape 마다 "바닥 외곽선(footprint) 폴리곤"만 정의하면, 3D 렌더러(renderIso)가
 * 높이(height)만큼 Extrude 하여 자동으로 3D 를 생성합니다.
 *
 * 확장 방법: 새 Shape 를 추가하려면 `registerShapeRenderer(shape, renderer)` 로
 * footprint 를 반환하는 Renderer 하나만 등록하면 3D 가 자동 동작합니다.
 */

export interface ShapeGeometry {
  /** 월드 좌표 바닥 외곽선(mm). renderIso 가 이 폴리곤을 extrude */
  footprint: PointMm[];
  /** 곡면 여부 — 텍스처 wrap(둘레 UV) 방식 판단용 */
  curved: boolean;
}

/** Shape → footprint 지오메트리 생성기 */
export type ShapeRenderer = (placed: PlacedFixture, def: FixtureDef) => ShapeGeometry;

const registry = new Map<FixtureShape, ShapeRenderer>();

/** Renderer 등록 (Shape 확장 지점) */
export function registerShapeRenderer(shape: FixtureShape, renderer: ShapeRenderer): void {
  registry.set(shape, renderer);
}

/** 등록된 Renderer 로 3D footprint 지오메트리 생성. 미등록 Shape 는 Rectangle 로 폴백 */
export function generateGeometry(placed: PlacedFixture, def: FixtureDef): ShapeGeometry {
  const renderer = registry.get(def.shape) ?? registry.get('rectangle')!;
  try {
    return renderer(placed, def);
  } catch {
    return rectangleRenderer(placed, def);
  }
}

// ---------------------------------------------------------------------------
// 공통 헬퍼
// ---------------------------------------------------------------------------

/** 로컬(좌상단 0,0 ~ w,d) 좌표를 회전·평행이동하여 월드(mm)로 변환. 회전축=좌상단 */
function toWorld(local: PointMm[], placed: PlacedFixture): PointMm[] {
  const rad = (placed.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return local.map((p) => ({
    xMm: placed.xMm + p.xMm * cos - p.yMm * sin,
    yMm: placed.yMm + p.xMm * sin + p.yMm * cos,
  }));
}

// ---------------------------------------------------------------------------
// RectangleRenderer — 박스
// ---------------------------------------------------------------------------
export const rectangleRenderer: ShapeRenderer = (placed, def) => ({
  footprint: getFixtureCorners(placed, def),
  curved: false,
});

// ---------------------------------------------------------------------------
// RoundedRenderer — 라운드 코너 (곡면 유지)
// ---------------------------------------------------------------------------
const ARC_SEGMENTS = 6;
export const roundedRenderer: ShapeRenderer = (placed, def) => {
  const w = def.widthMm;
  const d = def.depthMm;
  const r = Math.max(0, Math.min(def.cornerRadiusMm ?? 0, Math.min(w, d) / 2));
  if (r < 1) return rectangleRenderer(placed, def);
  const local: PointMm[] = [];
  // 각 코너 중심 + 시작각 (시계방향: TL→TR→BR→BL)
  const corners = [
    { cx: r, cy: r, start: Math.PI, end: Math.PI * 1.5 }, // 좌상
    { cx: w - r, cy: r, start: Math.PI * 1.5, end: Math.PI * 2 }, // 우상
    { cx: w - r, cy: d - r, start: 0, end: Math.PI * 0.5 }, // 우하
    { cx: r, cy: d - r, start: Math.PI * 0.5, end: Math.PI }, // 좌하
  ];
  for (const c of corners) {
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const a = c.start + ((c.end - c.start) * i) / ARC_SEGMENTS;
      local.push({ xMm: c.cx + Math.cos(a) * r, yMm: c.cy + Math.sin(a) * r });
    }
  }
  return { footprint: toWorld(local, placed), curved: true };
};

// ---------------------------------------------------------------------------
// CylinderRenderer — 원/타원 → 원기둥 실루엣
// ---------------------------------------------------------------------------
const CIRCLE_SEGMENTS = 32;
export const cylinderRenderer: ShapeRenderer = (placed, def) => {
  const rx = def.widthMm / 2;
  const ry = def.depthMm / 2;
  const local: PointMm[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    local.push({ xMm: rx + Math.cos(a) * rx, yMm: ry + Math.sin(a) * ry });
  }
  return { footprint: toWorld(local, placed), curved: true };
};

// ---------------------------------------------------------------------------
// SemicircleRenderer — 반원 (평평한 밑변 + 호)
// ---------------------------------------------------------------------------
export const semicircleRenderer: ShapeRenderer = (placed, def) => {
  const w = def.widthMm;
  const d = def.depthMm;
  const rx = w / 2;
  const local: PointMm[] = [];
  // 상단 반원 호 (밑변 y=d 기준으로 위로 볼록) — 근사
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (Math.PI * i) / steps; // 180° → 360°
    local.push({ xMm: rx + Math.cos(a) * rx, yMm: d + Math.sin(a) * d });
  }
  return { footprint: toWorld(local, placed), curved: true };
};

// ---------------------------------------------------------------------------
// PathRenderer — Custom Path / SVG Extrude (외곽선 샘플링 후 extrude)
// ---------------------------------------------------------------------------
const PATH_SAMPLES = 72;
export const pathRenderer: ShapeRenderer = (placed, def) => {
  if (!def.svgPath) return rectangleRenderer(placed, def);
  const sampled = samplePath(def.svgPath, PATH_SAMPLES);
  if (!sampled || sampled.length < 3) return rectangleRenderer(placed, def);
  // CUSTOM_PATH_VIEW(100x100) 기준 → widthMm x depthMm 로 스케일
  const local = sampled.map((p) => ({
    xMm: (p.xMm / CUSTOM_PATH_VIEW) * def.widthMm,
    yMm: (p.yMm / CUSTOM_PATH_VIEW) * def.depthMm,
  }));
  return { footprint: toWorld(local, placed), curved: true };
};

/** SVG path 문자열을 둘레를 따라 균등 샘플링한 폴리곤으로 (브라우저 SVG API 사용) */
function samplePath(dAttr: string, samples: number): PointMm[] | null {
  if (typeof document === 'undefined') return null;
  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dAttr);
    svg.appendChild(path);
    const total = path.getTotalLength();
    if (!total || !isFinite(total)) return null;
    const pts: PointMm[] = [];
    for (let i = 0; i < samples; i++) {
      const pt = path.getPointAtLength((total * i) / samples);
      pts.push({ xMm: pt.x, yMm: pt.y });
    }
    return pts;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Renderer 등록 (확장 지점: 새 Shape 는 여기에 한 줄 추가)
// ---------------------------------------------------------------------------
registerShapeRenderer('rectangle', rectangleRenderer);
registerShapeRenderer('roundedRectangle', roundedRenderer);
registerShapeRenderer('circle', cylinderRenderer);
registerShapeRenderer('semicircle', semicircleRenderer);
registerShapeRenderer('customPath', pathRenderer);

import type {
  FixtureMaterial,
  Product,
  ProductGeometryType,
  ProductMaterial,
} from '../../types';

/**
 * --- Product 3D Geometry (v0.9.9) ---
 * GLB 없이 현재 Geometry Engine(footprint + extrude) 방식으로 제품을 "얇은 판"이 아니라
 * Depth 를 가진 입체 오브젝트로 표현합니다. Bottle/Can/Jar/Tube 는 원기둥(곡면 wrap),
 * Box/Pouch 는 박스, Standee/FlatCard 는 얇은 판으로 생성합니다.
 */

const CIRCLE_SEGMENTS = 20;

export interface ProductGeo {
  /** 제품 로컬(원점 0,0) 좌표계의 footprint 폴리곤 (mm, scale 반영됨) */
  polygon: { lx: number; ly: number }[];
  /** 실제 사용된 깊이(front-back, mm) */
  depthMm: number;
  /** 곡면(원기둥) 여부 — 3D 측면 텍스처 wrap */
  curved: boolean;
}

/** Auto: 비율을 보고 가장 적합한 Geometry 를 선택 */
export function resolveGeometryType(product: Product): Exclude<ProductGeometryType, 'auto'> {
  const t = product.geometryType ?? 'auto';
  if (t !== 'auto') return t;
  const w = Math.max(1, product.widthMm);
  const d = Math.max(1, product.depthMm);
  const h = Math.max(1, product.heightMm ?? Math.max(w, d));
  const baseRatio = Math.max(w, d) / Math.min(w, d); // 밑면 정사각형에 가까울수록 1
  const tall = h / w; // 세로 비율
  const thin = Math.min(w, d) / h; // 아주 얇으면 카드

  if (thin < 0.12) return 'flatCard'; // 매우 얇음 → 카드
  if (baseRatio < 1.4) {
    // 밑면이 원형에 가까움 → 병/캔/자
    if (tall > 2.2) return 'bottle';
    if (tall > 1.2) return 'can';
    return 'jar';
  }
  if (tall > 1.6 && thin < 0.35) return 'standee'; // 세로로 서 있는 얇은 판
  return 'box';
}

/** 원(다각형 근사) footprint — 지름 diameter, 중심 (cx, cy) */
function circlePolygon(cx: number, cy: number, diameter: number): { lx: number; ly: number }[] {
  const r = diameter / 2;
  const pts: { lx: number; ly: number }[] = [];
  for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
    const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
    pts.push({ lx: cx + Math.cos(a) * r, ly: cy + Math.sin(a) * r });
  }
  return pts;
}

function rectPolygon(w: number, d: number): { lx: number; ly: number }[] {
  return [
    { lx: 0, ly: 0 },
    { lx: w, ly: 0 },
    { lx: w, ly: d },
    { lx: 0, ly: d },
  ];
}

/**
 * 제품 → 3D footprint 지오메트리 (scale 반영된 w/d 를 입력).
 * @param wMm scale 반영 폭(mm)
 * @param dMm scale 반영 깊이(mm)
 */
export function productGeometry(product: Product, wMm: number, dMm: number): ProductGeo {
  const type = resolveGeometryType(product);
  const scaleFromBase = product.depthMm > 0 ? dMm / product.depthMm : 1;
  const thickness = product.thicknessMm != null ? product.thicknessMm * scaleFromBase : dMm;

  switch (type) {
    case 'bottle':
    case 'tube':
    case 'can':
    case 'jar': {
      // 원기둥: 지름 = 폭, 정사각 밑면 중심 배치
      const diameter = wMm;
      return { polygon: circlePolygon(wMm / 2, diameter / 2, diameter), depthMm: diameter, curved: true };
    }
    case 'flatCard':
    case 'standee': {
      const depth = Math.max(3, product.thicknessMm != null ? thickness : Math.min(dMm, wMm * 0.06));
      return { polygon: rectPolygon(wMm, depth), depthMm: depth, curved: false };
    }
    case 'pouch': {
      const depth = Math.max(6, product.thicknessMm != null ? thickness : Math.min(dMm, wMm * 0.18));
      return { polygon: rectPolygon(wMm, depth), depthMm: depth, curved: false };
    }
    case 'box':
    default: {
      const depth = product.thicknessMm != null ? thickness : dMm;
      return { polygon: rectPolygon(wMm, depth), depthMm: depth, curved: false };
    }
  }
}

/** 제품 재질 → 렌더러(FixtureMaterial) 매핑 (v0.9.9) */
export function productMaterialToFixture(m: ProductMaterial | undefined): FixtureMaterial {
  switch (m) {
    case 'glossy':
      return 'gloss';
    case 'metal':
      return 'gloss';
    case 'plastic':
      return 'semiGloss';
    case 'glass':
      return 'transparent';
    case 'paper':
    case 'matte':
    default:
      return 'matte';
  }
}

export const PRODUCT_GEOMETRY_TYPES: { value: ProductGeometryType; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'bottle', label: 'Bottle' },
  { value: 'tube', label: 'Tube' },
  { value: 'box', label: 'Box' },
  { value: 'pouch', label: 'Pouch' },
  { value: 'jar', label: 'Jar' },
  { value: 'can', label: 'Can' },
  { value: 'standee', label: 'Standee' },
  { value: 'flatCard', label: 'Flat Card' },
];

export const PRODUCT_MATERIALS: { value: ProductMaterial; label: string }[] = [
  { value: 'paper', label: 'Paper' },
  { value: 'matte', label: 'Matte' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'glossy', label: 'Glossy' },
  { value: 'glass', label: 'Glass' },
  { value: 'metal', label: 'Metal' },
];

export const THICKNESS_PRESETS = [5, 20, 40, 80, 120];

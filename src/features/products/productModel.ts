import type { PlacedProduct, Product, ProductFacing } from '../../types';
import { generateId } from '../../utils/id';

/**
 * Digital Merchandising — 제품 모델 헬퍼 (v0.9.3).
 * 제품 배치 기하/충돌/통계/그리드 배열 등 순수 계산. 2D/3D/Print/Guide 공용.
 */

export const PRODUCT_FACINGS: { value: ProductFacing; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
];

export const DEFAULT_PRODUCT_COLOR = '#f59e0b';

/** 배치 제품의 평면 footprint 크기(mm) — scale 반영 */
export function productSize(product: Product, placed: PlacedProduct): { w: number; d: number } {
  const s = placed.scale || 1;
  return { w: Math.max(1, product.widthMm * s), d: Math.max(1, product.depthMm * s) };
}

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** 회전 반영 AABB (회전축=좌상단) */
export function productAABB(product: Product, placed: PlacedProduct): AABB {
  const { w, d } = productSize(product, placed);
  const rad = (placed.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [0, 0],
    [w, 0],
    [w, d],
    [0, d],
  ].map(([lx, ly]) => ({ x: placed.xMm + lx * cos - ly * sin, y: placed.yMm + lx * sin + ly * cos }));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function overlaps(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/** 겹치는 제품 배치 id 집합 (Collision Detection #17) */
export function detectCollisions(
  placed: PlacedProduct[],
  productById: (id: string) => Product | undefined,
): Set<string> {
  const boxes = placed
    .map((p) => {
      const def = productById(p.productId);
      return def ? { id: p.id, aabb: productAABB(def, p) } : null;
    })
    .filter((b): b is { id: string; aabb: AABB } => b != null);
  const hit = new Set<string>();
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      // 1mm 여유(맞닿음 허용)
      const a = boxes[i].aabb;
      const b = boxes[j].aabb;
      const shrink = (x: AABB): AABB => ({ minX: x.minX + 1, minY: x.minY + 1, maxX: x.maxX - 1, maxY: x.maxY - 1 });
      if (overlaps(shrink(a), shrink(b))) {
        hit.add(boxes[i].id);
        hit.add(boxes[j].id);
      }
    }
  }
  return hit;
}

export interface DisplayStats {
  total: number;
  categories: { name: string; count: number }[];
  brands: { name: string; count: number }[];
  uniqueProducts: number;
}

/** 진열 통계 (#18) */
export function computeDisplayStats(
  placed: PlacedProduct[],
  productById: (id: string) => Product | undefined,
): DisplayStats {
  const catMap = new Map<string, number>();
  const brandMap = new Map<string, number>();
  const uniq = new Set<string>();
  for (const p of placed) {
    const def = productById(p.productId);
    if (!def) continue;
    uniq.add(def.id);
    const cat = def.category || '미분류';
    const brand = def.brand || '미지정';
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
    brandMap.set(brand, (brandMap.get(brand) ?? 0) + 1);
  }
  const toArr = (m: Map<string, number>) =>
    [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  return { total: placed.length, categories: toArr(catMap), brands: toArr(brandMap), uniqueProducts: uniq.size };
}

/** Shelf 폭(mm) + 제품 폭(mm) → 최대 진열 개수 (Shelf Capacity #16) */
export function shelfCapacity(shelfWidthMm: number, productWidthMm: number, spacingMm = 0): number {
  const unit = productWidthMm + spacingMm;
  if (unit <= 0) return 0;
  return Math.max(0, Math.floor((shelfWidthMm + spacingMm) / unit));
}

/** 진열 배열 패턴 (v0.9.9): Single/Grid/Row/Circle */
export type ArrangePattern = 'single' | 'grid' | 'row' | 'circle';

/** 균등 배열 (Grid/Row/Circle) — Grid Arrangement #7 + Spacing #8 + 패턴(v0.9.9) */
export function gridArrange(
  productId: string,
  product: Product,
  count: number,
  opts: {
    originXMm: number;
    originYMm: number;
    spacingXMm?: number;
    spacingYMm?: number;
    cols?: number;
    scale?: number;
    facing?: ProductFacing;
    pattern?: ArrangePattern;
    radiusMm?: number;
  },
): PlacedProduct[] {
  if (count < 1) return [];
  const scale = opts.scale ?? 1;
  const w = product.widthMm * scale;
  const d = product.depthMm * scale;
  const sx = opts.spacingXMm ?? Math.round(w * 0.15);
  const sy = opts.spacingYMm ?? Math.round(d * 0.3);
  const facing = opts.facing ?? product.displayDirection ?? 'front';
  const pattern = opts.pattern ?? 'grid';
  const mk = (xMm: number, yMm: number, rotationDeg = 0): PlacedProduct => ({
    id: generateId(),
    productId,
    xMm: Math.round(xMm),
    yMm: Math.round(yMm),
    rotationDeg,
    scale,
    facing,
  });

  // Circle: 원형으로 균등 배치 (반지름 기본 = 제품이 겹치지 않을 최소 반지름)
  if (pattern === 'circle' && count > 1) {
    const step = (Math.PI * 2) / count;
    const minR = ((w + sx) * count) / (Math.PI * 2);
    const radius = opts.radiusMm ?? Math.max(w + sx, minR);
    const cxWorld = opts.originXMm + radius;
    const cyWorld = opts.originYMm + radius;
    const out: PlacedProduct[] = [];
    for (let i = 0; i < count; i++) {
      const a = i * step;
      out.push(mk(cxWorld + Math.cos(a) * radius - w / 2, cyWorld + Math.sin(a) * radius - d / 2));
    }
    return out;
  }

  // Row: 한 줄. Grid: 정사각형에 가깝게 열 수 자동. Single: 1개.
  const cols =
    pattern === 'row' ? count : pattern === 'single' ? 1 : opts.cols ?? Math.max(1, Math.round(Math.sqrt(count)));
  const n = pattern === 'single' ? 1 : count;
  const out: PlacedProduct[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    out.push(mk(opts.originXMm + c * (w + sx), opts.originYMm + r * (d + sy)));
  }
  return out;
}

/** 제품 라이브러리에서 id → Product */
export function productById(products: Product[] | undefined, id: string): Product | undefined {
  return products?.find((p) => p.id === id);
}

/** 제품 진열 시 사용할 이미지(dataURL) — facing 우선, 없으면 thumbnail */
export function productImageUrl(product: Product, facing: ProductFacing): string | undefined {
  return product.images?.[facing] ?? product.thumbnailUrl ?? product.images?.front;
}

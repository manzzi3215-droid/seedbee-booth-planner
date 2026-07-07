import type { Product } from '../../types';
import type { IsoScene, IsoBox, IsoFaceTexture } from '../iso/scene';
import { renderIsoSceneToDataURL, DEFAULT_ISO_OPTIONS } from '../iso/renderIso';
import { productRenderGeo, productMaterialToFixture } from './productGeometry';
import { productImageUrl } from './productModel';

/**
 * 제품 1개를 3D 로 렌더링(Product Library Hover Preview, v0.9.9).
 * 기존 Geometry Engine/renderIso 를 그대로 재사용해 작은 미리보기 이미지를 만든다.
 */
export function renderProductPreview(
  product: Product,
  imageElements: Map<string, HTMLImageElement>,
  targetPx = 320,
): string {
  const w = Math.max(20, product.widthMm);
  const d = Math.max(20, product.depthMm);
  const h = Math.max(30, product.heightMm ?? Math.max(w, d));
  const geo = productRenderGeo(product, w, d, h);

  const footprint = geo.polygon.map(({ lx, ly }) => ({ x: lx, y: ly, z: 0 }));
  const img = productImageUrl(product, product.displayDirection ?? 'front');
  const transparent = product.backgroundMode === 'transparent';

  let faces: IsoBox['faces'];
  let wrapTexture: IsoFaceTexture | undefined;
  if (img) {
    if (geo.imageFaces === 'wrap') {
      wrapTexture = { url: img, opacity: 1 };
      faces = { top: { url: img, opacity: 1 } };
    } else if (geo.imageFaces === 'top') {
      faces = { top: { url: img, opacity: 1 } };
    } else if (geo.imageFaces === 'frontBack') {
      faces = { front: { url: img, opacity: 1 }, back: { url: img, opacity: 1 } };
    } else {
      faces = { top: { url: img, opacity: 1 }, front: { url: img, opacity: 1 }, back: { url: img, opacity: 1 }, left: { url: img, opacity: 1 }, right: { url: img, opacity: 1 } };
    }
  }

  // 제품을 둘러싼 작은 바닥
  const xs = footprint.map((p) => p.x);
  const ys = footprint.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const mgx = (maxX - minX) * 0.6 + 40;
  const mgy = (maxY - minY) * 0.6 + 40;
  const floorPolygon = [
    { x: minX - mgx, y: minY - mgy, z: 0 },
    { x: maxX + mgx, y: minY - mgy, z: 0 },
    { x: maxX + mgx, y: maxY + mgy, z: 0 },
    { x: minX - mgx, y: maxY + mgy, z: 0 },
  ];

  const scene: IsoScene = {
    floorPolygon,
    walls: [],
    boxes: [
      {
        footprint,
        heightMm: geo.heightMm,
        color: product.displayColor ?? '#f59e0b',
        opacity: transparent && img ? 0 : 1,
        name: '',
        faces,
        curved: geo.curved,
        wrapTexture,
        material: productMaterialToFixture(product.material),
      },
    ],
    floorImages: [],
  };

  return renderIsoSceneToDataURL(scene, imageElements, {
    ...DEFAULT_ISO_OPTIONS,
    viewpoint: 'frontDiagonal',
    showNames: false,
    floorChecker: false,
    floorColor: '#eef1f5',
    targetPx,
  });
}

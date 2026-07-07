import type { Product, VmdBoard } from '../../types';
import type { IsoScene, IsoBox, IsoFaceTexture } from '../iso/scene';
import { productRenderGeo, productMaterialToFixture } from '../products/productGeometry';
import { productImageUrl } from '../products/productModel';

/**
 * --- VMD → 3D Mockup (v1.0.3) ---
 * VMD 2D 보드를 기존 Booth 3D 렌더러(renderIso)가 소비하는 IsoScene 으로 변환.
 * 보드 = 진열 상판(바닥 폴리곤), 요소 = 상판 위에 놓인 3D 오브젝트.
 *  - product/image(POP·QR·로고) → 세워진 카드/입체(제품 렌더모드 반영, 그림자·높이·두께)
 *  - shape/text(가격표·설명카드) → 상판 위에 놓인 얇은 카드/타일
 *
 * ⚠️ 새 렌더러를 만들지 않고 renderIsoSceneToDataURL 을 그대로 재사용합니다.
 */

/** VMD 이미지 요소(비제품)의 세움 카드 두께 */
const IMAGE_CARD_THICKNESS = 15;
/** 바닥에 놓인 카드/타일 높이 */
const FLAT_HEIGHT = 6;

/** 렌더에 필요한 모든 이미지 소스 수집 (preload 용) */
export function collectVmdImageSrcs(board: VmdBoard, products: Product[]): string[] {
  const out: string[] = [];
  for (const el of board.elements) {
    if (el.hidden) continue;
    if (el.type === 'product' && el.productId) {
      const p = products.find((x) => x.id === el.productId);
      const s = p ? productImageUrl(p, p.displayDirection ?? 'front') : undefined;
      if (s) out.push(s);
    } else if ((el.type === 'image') && el.src) {
      out.push(el.src);
    }
  }
  return out;
}

/**
 * 면 텍스처 구성. front 면은 좌우 반전(flipH)해 3D 정면에서 라벨이 뒤집히지 않게 함(§5, v1.0.4).
 * (footprint 감김 방향상 front 면은 우→좌로 그려져 이미지가 반전되므로 보정)
 */
function facesFromImage(imageFaces: string, url: string): IsoBox['faces'] {
  const front = { url, opacity: 1, flipH: true };
  const back = { url, opacity: 1 };
  if (imageFaces === 'top') return { top: { url, opacity: 1 } };
  if (imageFaces === 'frontBack') return { front, back };
  return { top: { url, opacity: 1 }, front, back, left: { url, opacity: 1, flipH: true }, right: { url, opacity: 1 } };
}

export function vmdBoardToIsoScene(board: VmdBoard, products: Product[]): IsoScene {
  const boxes: IsoBox[] = [];

  for (const el of board.elements) {
    if (el.hidden || el.type === 'line') continue;

    const rot = (el.rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const place = (poly: { lx: number; ly: number }[]) =>
      poly.map(({ lx, ly }) => ({ x: el.xMm + lx * cos - ly * sin, y: el.yMm + lx * sin + ly * cos, z: 0 }));

    if (el.type === 'product' && el.productId) {
      const prod = products.find((x) => x.id === el.productId);
      if (!prod) continue;
      // 2D 요소의 widthMm=폭(X), heightMm=세움 높이(Z). 두께는 렌더모드에서 계산.
      const nominalDepth = Math.max(20, el.widthMm * 0.4);
      const geo = productRenderGeo(prod, el.widthMm, nominalDepth, el.heightMm);
      const img = productImageUrl(prod, prod.displayDirection ?? 'front');
      let faces: IsoBox['faces'];
      let wrapTexture: IsoFaceTexture | undefined;
      if (img) {
        if (geo.imageFaces === 'wrap') { wrapTexture = { url: img, opacity: 1, flipH: true }; faces = { top: { url: img, opacity: 1 } }; }
        else faces = facesFromImage(geo.imageFaces, img);
      }
      // §6: 항상 solid 카드(두께/측면 색/접지 그림자) — 정면 이미지 + 측면 대표색
      boxes.push({
        footprint: place(geo.polygon),
        heightMm: geo.heightMm,
        color: prod.displayColor ?? '#eef1f5',
        opacity: 1,
        name: '',
        faces,
        curved: geo.curved,
        wrapTexture,
        material: productMaterialToFixture(prod.material),
      });
    } else if (el.type === 'image' && el.src) {
      // POP/QR/로고/이미지 → 세워진 카드(정면/후면 이미지)
      const poly = [
        { lx: 0, ly: 0 },
        { lx: el.widthMm, ly: 0 },
        { lx: el.widthMm, ly: IMAGE_CARD_THICKNESS },
        { lx: 0, ly: IMAGE_CARD_THICKNESS },
      ];
      boxes.push({
        footprint: place(poly),
        heightMm: Math.max(20, el.heightMm),
        color: '#ffffff',
        opacity: 1,
        name: '',
        faces: { front: { url: el.src, opacity: 1, flipH: true }, back: { url: el.src, opacity: 1 } },
        material: 'matte',
      });
    } else if (el.type === 'shape' || el.type === 'text') {
      // 도형/텍스트(가격표·설명카드) → 상판 위에 놓인 얇은 카드/타일
      const poly = [
        { lx: 0, ly: 0 },
        { lx: el.widthMm, ly: 0 },
        { lx: el.widthMm, ly: el.heightMm },
        { lx: 0, ly: el.heightMm },
      ];
      const color = el.type === 'shape' ? el.fill ?? '#fde047' : el.bgColor ?? '#ffffff';
      boxes.push({
        footprint: place(poly),
        heightMm: FLAT_HEIGHT,
        color,
        opacity: el.type === 'text' && !el.bgColor ? 0.9 : 1,
        name: '',
        material: 'matte',
      });
    }
  }

  const floorPolygon = [
    { x: 0, y: 0, z: 0 },
    { x: board.widthMm, y: 0, z: 0 },
    { x: board.widthMm, y: board.heightMm, z: 0 },
    { x: 0, y: board.heightMm, z: 0 },
  ];

  return { floorPolygon, walls: [], boxes, floorImages: [] };
}

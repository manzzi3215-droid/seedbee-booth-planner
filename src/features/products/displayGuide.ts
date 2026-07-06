import type {
  BoothConfig,
  FixtureDef,
  PlacedDimension,
  PlacedFixture,
  PlacedImage,
  PlacedProduct,
  PlacedText,
  Product,
  DesignAsset,
} from '../../types';
import { createBoothDrawingDataURL } from '../export/renderBooth';
import { preloadImages, buildBaseName, downloadDataURL, sanitizeFilename } from '../export/download';
import { productImageSrcs } from '../export/exportLayout';
import { computeDisplayStats } from './productModel';

/**
 * Display Guide (v0.9.3) — 현장 작업자가 그대로 보고 진열할 수 있는 진열 가이드.
 * 평면 진열도(제품 포함) + 제품 목록표(제품명·브랜드·크기·수량·Facing)를 한 장에 구성해 PNG/PDF 로 출력.
 */

export interface DisplayGuideInput {
  projectName: string;
  layoutName: string;
  booth: BoothConfig;
  placed: PlacedFixture[];
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  images: PlacedImage[];
  backgrounds: PlacedImage[];
  fixturesById: Map<string, FixtureDef>;
  designAssets: DesignAsset[];
  placedProducts: PlacedProduct[];
  products: Product[];
}

interface GuideRow {
  name: string;
  brand: string;
  sizeLabel: string;
  count: number;
  facing: string;
  color: string;
}

function buildRows(placedProducts: PlacedProduct[], products: Product[]): GuideRow[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const agg = new Map<string, GuideRow>();
  for (const pp of placedProducts) {
    const prod = byId.get(pp.productId);
    if (!prod) continue;
    const key = `${pp.productId}_${pp.facing}`;
    const ex = agg.get(key);
    if (ex) ex.count += 1;
    else
      agg.set(key, {
        name: prod.name,
        brand: prod.brand || '—',
        sizeLabel: `${prod.widthMm}×${prod.depthMm}${prod.heightMm ? `×${prod.heightMm}` : ''}mm`,
        count: 1,
        facing: pp.facing,
        color: prod.displayColor || '#f59e0b',
      });
  }
  return [...agg.values()].sort((a, b) => b.count - a.count);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 진열 가이드 이미지(PNG dataURL) 생성 */
export async function buildDisplayGuideDataURL(input: DisplayGuideInput): Promise<string> {
  const imageEls = await preloadImages([
    ...[...input.backgrounds, ...input.images].map((i) => i.srcDataUrl),
    ...input.designAssets.map((a) => a.url),
    ...productImageSrcs(input.placedProducts, input.products),
  ]);
  const planUrl = createBoothDrawingDataURL(
    input.booth,
    input.placed,
    input.texts,
    input.dimensions,
    input.images,
    input.backgrounds,
    imageEls,
    input.fixturesById,
    true,
    { pixelRatio: 2, designAssets: input.designAssets, placedProducts: input.placedProducts, products: input.products },
  );
  const planImg = await loadImage(planUrl);

  const R = 6;
  const PAGE_W = 297;
  const PAGE_H = 210;
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W * R;
  canvas.height = PAGE_H * R;
  const ctx = canvas.getContext('2d')!;
  const font = (mm: number, bold = false) => `${bold ? 'bold ' : ''}${mm * R}px Pretendard, system-ui, "Malgun Gothic", sans-serif`;
  const mm = (v: number) => v * R;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const PAD = 12;

  // 헤더
  ctx.fillStyle = '#0f172a';
  ctx.textBaseline = 'alphabetic';
  ctx.font = font(7, true);
  ctx.fillText(`${input.projectName} · ${input.layoutName} — 진열 가이드`, mm(PAD), mm(20));

  const stats = computeDisplayStats(input.placedProducts, (id) => input.products.find((p) => p.id === id));
  ctx.fillStyle = '#475569';
  ctx.font = font(3.6);
  ctx.fillText(`총 진열 ${stats.total}개 · 제품 종류 ${stats.uniqueProducts} · 카테고리 ${stats.categories.length} · 브랜드 ${stats.brands.length}`, mm(PAD), mm(28));

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = mm(0.4);
  ctx.beginPath();
  ctx.moveTo(mm(PAD), mm(32));
  ctx.lineTo(mm(PAGE_W - PAD), mm(32));
  ctx.stroke();

  // 진열도 (왼쪽)
  const drawBoxX = PAD, drawBoxY = 38, drawBoxW = 168, drawBoxH = 160;
  ctx.fillStyle = '#334155';
  ctx.font = font(4, true);
  ctx.fillText('진열도', mm(drawBoxX), mm(drawBoxY - 1));
  const boxRatio = drawBoxW / drawBoxH;
  const imgRatio = planImg.width / planImg.height;
  let dw = drawBoxW;
  let dh = drawBoxH;
  if (imgRatio > boxRatio) dh = drawBoxW / imgRatio;
  else dw = drawBoxH * imgRatio;
  const dx = drawBoxX + (drawBoxW - dw) / 2;
  const dy = drawBoxY + 2 + (drawBoxH - dh) / 2;
  ctx.drawImage(planImg, mm(dx), mm(dy), mm(dw), mm(dh));

  // 제품 목록표 (오른쪽)
  const tblX = 188;
  let ty = 38;
  ctx.fillStyle = '#334155';
  ctx.font = font(4, true);
  ctx.fillText('제품 목록', mm(tblX), mm(ty - 1));
  ty += 5;
  ctx.font = font(3, true);
  ctx.fillStyle = '#64748b';
  ctx.fillText('제품 / 브랜드', mm(tblX), mm(ty));
  ctx.textAlign = 'right';
  ctx.fillText('수량', mm(PAGE_W - PAD), mm(ty));
  ctx.textAlign = 'left';
  ty += 1.5;
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = mm(0.3);
  ctx.beginPath();
  ctx.moveTo(mm(tblX), mm(ty));
  ctx.lineTo(mm(PAGE_W - PAD), mm(ty));
  ctx.stroke();
  ty += 4.5;

  const rows = buildRows(input.placedProducts, input.products);
  const rowH = 8;
  for (const row of rows) {
    if (ty > PAGE_H - PAD) break;
    // 색 스와치
    ctx.fillStyle = row.color;
    ctx.fillRect(mm(tblX), mm(ty - 3), mm(3), mm(3));
    ctx.fillStyle = '#0f172a';
    ctx.font = font(3.4, true);
    ctx.fillText(row.name, mm(tblX + 4), mm(ty));
    ctx.fillStyle = '#64748b';
    ctx.font = font(2.7);
    ctx.fillText(`${row.brand} · ${row.sizeLabel} · Facing ${row.facing}`, mm(tblX + 4), mm(ty + 3));
    ctx.fillStyle = '#0f172a';
    ctx.font = font(4, true);
    ctx.textAlign = 'right';
    ctx.fillText(`${row.count}`, mm(PAGE_W - PAD), mm(ty + 1));
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#eef2f7';
    ctx.beginPath();
    ctx.moveTo(mm(tblX), mm(ty + 4.5));
    ctx.lineTo(mm(PAGE_W - PAD), mm(ty + 4.5));
    ctx.stroke();
    ty += rowH;
  }
  if (rows.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = font(3.2);
    ctx.fillText('진열된 제품이 없습니다.', mm(tblX), mm(ty));
  }

  return canvas.toDataURL('image/png');
}

export async function downloadDisplayGuidePNG(input: DisplayGuideInput): Promise<void> {
  const url = await buildDisplayGuideDataURL(input);
  downloadDataURL(url, `${buildBaseName(input.projectName, input.layoutName)}_진열가이드.png`);
}

export async function downloadDisplayGuidePDF(input: DisplayGuideInput): Promise<void> {
  const url = await buildDisplayGuideDataURL(input);
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  pdf.addImage(url, 'PNG', 0, 0, 297, 210);
  pdf.save(`${sanitizeFilename(input.projectName)}_${sanitizeFilename(input.layoutName)}_진열가이드.pdf`);
}

import type { MappingMode, PrintFaceSettings, TextureTransform } from '../../types';
import { computeFitRect } from '../design/mapping';

/** 재단선을 위한 여백(mm) — crop mark ON 일 때 블리드 바깥에 확보 */
export const MARK_MARGIN_MM = 5;

export interface PrintFaceRenderParams {
  face: PrintFaceSettings;
  image?: HTMLImageElement | null;
  mode: MappingMode;
  /** 미리보기용 재단(trim) 가이드 라인 표시 (PDF 에서는 false) */
  showTrimGuide: boolean;
  /** 해상도 (px/mm). 미리보기는 낮게, PDF 는 높게(단, 최대 캔버스 크기로 캡) */
  pxPerMm: number;
  /** 캔버스 한 변 최대 px (메모리 보호) */
  maxDimPx?: number;
}

/** 재단선 여백 포함, 페이지 전체 크기(mm) */
export function pagePrintSizeMm(face: PrintFaceSettings): { widthMm: number; heightMm: number } {
  const margin = face.cropMark ? MARK_MARGIN_MM : 0;
  return {
    widthMm: face.widthMm + face.bleedMm * 2 + margin * 2,
    heightMm: face.heightMm + face.bleedMm * 2 + margin * 2,
  };
}

/**
 * 한 면의 실제 출력물을 캔버스에 렌더 (미리보기 + PDF 공용).
 * 구성: 흰 배경 → 디자인(블리드 박스 채움) → 안전영역(dashed) → 재단선(crop mark) → 재단 가이드.
 * 반환 캔버스의 픽셀 크기 = 페이지(mm) × 유효 px/mm.
 */
export function renderPrintFaceCanvas(params: PrintFaceRenderParams): HTMLCanvasElement {
  const { face, image, mode, showTrimGuide } = params;
  const margin = face.cropMark ? MARK_MARGIN_MM : 0;
  const page = pagePrintSizeMm(face);
  const bleedW = face.widthMm + face.bleedMm * 2;
  const bleedH = face.heightMm + face.bleedMm * 2;

  // 유효 해상도: 최대 캔버스 크기로 캡
  const maxDim = params.maxDimPx ?? 4096;
  const ppm = Math.min(params.pxPerMm, maxDim / Math.max(page.widthMm, page.heightMm));

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(page.widthMm * ppm));
  canvas.height = Math.max(1, Math.round(page.heightMm * ppm));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(ppm, ppm); // 이후 mm 단위로 그리기

  // 흰 배경(페이지 전체)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, page.widthMm, page.heightMm);

  // 블리드 박스 원점(재단 여백 안쪽)
  const bx = margin;
  const by = margin;
  // 재단(trim) 박스 원점(블리드 안쪽)
  const tx = margin + face.bleedMm;
  const ty = margin + face.bleedMm;

  // 디자인 이미지 — 블리드 박스를 채움(도련까지 이미지 연장)
  if (image && image.width > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bleedW, bleedH);
    ctx.clip();
    drawDesign(ctx, image, mode, face.transform, bx, by, bleedW, bleedH);
    ctx.restore();
  }

  // 안전영역 (재단 박스에서 safeAreaMm 안쪽, dashed magenta)
  if (face.safeAreaOn && face.safeAreaMm > 0) {
    const s = face.safeAreaMm;
    ctx.save();
    ctx.strokeStyle = 'rgba(217,70,239,0.9)';
    ctx.lineWidth = Math.max(0.2, 1 / ppm);
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(tx + s, ty + s, face.widthMm - s * 2, face.heightMm - s * 2);
    ctx.restore();
  }

  // 재단 가이드(미리보기 전용, 얇은 파선)
  if (showTrimGuide) {
    ctx.save();
    ctx.strokeStyle = 'rgba(37,99,235,0.7)';
    ctx.lineWidth = Math.max(0.15, 0.8 / ppm);
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(tx, ty, face.widthMm, face.heightMm);
    ctx.restore();
  }

  // 재단선(crop mark) — 흰 여백에 재단선 위치 표시
  if (face.cropMark) {
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(0.15, 0.6 / ppm);
    ctx.setLineDash([]);
    const marks: [number, number, number, number][] = [];
    const x0 = tx;
    const x1 = tx + face.widthMm;
    const y0 = ty;
    const y1 = ty + face.heightMm;
    // 각 재단선 연장선 (여백 영역 내)
    // 세로선(좌/우), 상·하 여백
    marks.push([x0, 0, x0, margin], [x0, page.heightMm - margin, x0, page.heightMm]);
    marks.push([x1, 0, x1, margin], [x1, page.heightMm - margin, x1, page.heightMm]);
    // 가로선(상/하), 좌·우 여백
    marks.push([0, y0, margin, y0], [page.widthMm - margin, y0, page.widthMm, y0]);
    marks.push([0, y1, margin, y1], [page.widthMm - margin, y1, page.widthMm, y1]);
    for (const [ax, ay, bx2, by2] of marks) {
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx2, by2);
      ctx.stroke();
    }
    ctx.restore();
  }

  return canvas;
}

/** 디자인 이미지를 매핑 방식/변형으로 (ox,oy,fw,fh) 영역에 그림 */
function drawDesign(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  mode: MappingMode,
  t: TextureTransform,
  ox: number,
  oy: number,
  fw: number,
  fh: number,
): void {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (iw <= 0 || ih <= 0) return;

  if (mode === 'tile') {
    const baseW = (fw / 3) * (t.scale || 1);
    const baseH = baseW * (ih / iw);
    const offX = t.offsetX * fw;
    const offY = t.offsetY * fh;
    for (let y = -baseH; y < fh + baseH; y += baseH) {
      for (let x = -baseW; x < fw + baseW; x += baseW) {
        ctx.drawImage(image, ox + x + offX, oy + y + offY, baseW, baseH);
      }
    }
    return;
  }

  const { dw, dh } = computeFitRect(iw, ih, fw, fh, mode);
  const sdw = dw * (t.scale || 1);
  const sdh = dh * (t.scale || 1);
  const cx = ox + fw / 2 + t.offsetX * fw;
  const cy = oy + fh / 2 + t.offsetY * fh;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((t.rotationDeg * Math.PI) / 180);
  ctx.scale(t.flipH ? -1 : 1, t.flipV ? -1 : 1);
  ctx.drawImage(image, -sdw / 2, -sdh / 2, sdw, sdh);
  ctx.restore();
}

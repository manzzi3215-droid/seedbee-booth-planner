/**
 * Floorplan Import (v0.9.6) — 실제 행사장 도면(PDF/PNG/JPG/SVG)을 이미지 dataURL 로 변환.
 * PDF 는 pdfjs 로 1페이지를 렌더(지연 로드). 결과는 Firestore 문서 크기를 고려해 경량 dataURL 로 압축.
 * DXF/DWG 는 이번 버전에서 벡터 파싱 미지원(향후 확장 지점) — 사용자에게 이미지/PDF 변환 안내.
 */

const MAX_SIDE = 1600;
const MAX_DATAURL_LEN = 1_400_000;

export interface FloorplanImage {
  url: string; // dataURL
  widthPx: number;
  heightPx: number;
  kind: 'pdf' | 'raster' | 'svg';
}

export function isSupportedFloorplan(file: File): boolean {
  return /pdf|png|jpe?g|webp|svg/i.test(file.type) || /\.(pdf|png|jpe?g|webp|svg)$/i.test(file.name);
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}
export function isSvg(file: File): boolean {
  return /svg/i.test(file.type) || /\.svg$/i.test(file.name);
}
export function isCad(file: File): boolean {
  return /\.(dxf|dwg)$/i.test(file.name);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 캔버스를 크기/용량 한계에 맞춰 dataURL 로 (라인 도면은 PNG 우선, 초과 시 JPEG) */
function canvasToBoundedDataUrl(canvas: HTMLCanvasElement): string {
  let url = canvas.toDataURL('image/png');
  if (url.length > MAX_DATAURL_LEN) url = canvas.toDataURL('image/jpeg', 0.82);
  return url;
}

function drawScaled(img: HTMLImageElement | HTMLCanvasElement, iw: number, ih: number): HTMLCanvasElement {
  const scale = Math.min(1, MAX_SIDE / Math.max(iw, ih || 1));
  const cw = Math.max(1, Math.round(iw * scale));
  const ch = Math.max(1, Math.round((ih || iw) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // 흰 배경(투명 PDF/도면 대비)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, 0, 0, cw, ch);
  return canvas;
}

async function pdfToImage(file: File): Promise<FloorplanImage> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(2.5, MAX_SIDE / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport } as unknown as Parameters<typeof page.render>[0]).promise;
  return { url: canvasToBoundedDataUrl(canvas), widthPx: canvas.width, heightPx: canvas.height, kind: 'pdf' };
}

async function rasterOrSvgToImage(file: File, kind: 'raster' | 'svg'): Promise<FloorplanImage> {
  let src: string;
  if (kind === 'svg') {
    const text = await file.text();
    src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  } else {
    src = URL.createObjectURL(file);
  }
  try {
    const img = await loadImage(src);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const canvas = drawScaled(img, iw, ih);
    return { url: canvasToBoundedDataUrl(canvas), widthPx: canvas.width, heightPx: canvas.height, kind };
  } finally {
    if (kind !== 'svg') URL.revokeObjectURL(src);
  }
}

/** 파일 → 도면 이미지(dataURL + px). PDF/PNG/JPG/SVG 지원 */
export async function fileToFloorplanImage(file: File): Promise<FloorplanImage> {
  if (isPdf(file)) return pdfToImage(file);
  if (isSvg(file)) return rasterOrSvgToImage(file, 'svg');
  return rasterOrSvgToImage(file, 'raster');
}

/**
 * 이미지 보정 (밝기/대비/반전/임계값) — 흐린 도면 개선 (#14).
 * 원본 dataURL → 보정된 dataURL 재생성.
 */
export interface Enhance {
  brightness: number; // -100..100
  contrast: number; // -100..100
  invert: boolean;
  threshold: boolean; // 흑백 이진화
}
export const DEFAULT_ENHANCE: Enhance = { brightness: 0, contrast: 0, invert: false, threshold: false };

export async function enhanceImage(srcUrl: string, e: Enhance): Promise<string> {
  const img = await loadImage(srcUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data;
  const b = e.brightness * 2.55;
  const c = (259 * (e.contrast + 255)) / (255 * (259 - e.contrast));
  for (let i = 0; i < d.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      let v = d[i + k];
      v = c * (v - 128) + 128 + b;
      if (e.invert) v = 255 - v;
      d[i + k] = Math.max(0, Math.min(255, v));
    }
    if (e.threshold) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const t = g > 128 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = t;
    }
  }
  ctx.putImageData(data, 0, 0);
  return canvasToBoundedDataUrl(canvas);
}

import { firebaseConfig, isFirebaseConfigured } from './config';
import { generateId } from '../utils/id';
import type { DesignAsset } from '../types';

/**
 * 디자인 에셋 생성 (Design Mapping, v0.9.1 재작성).
 *
 * v0.8.7 은 Firebase Storage 업로드에 의존했으나, 정적 호스팅(Firebase Hosting/GitHub Pages)
 * 환경에서 Storage 보안 규칙/CORS 문제로 업로드·렌더·출력이 실패하는 경우가 많았습니다.
 * v0.9.1 은 이미지를 "경량 dataURL"로 인코딩하여 배치안(Firestore/localStorage)에 함께 저장합니다.
 *  - 업로드/2D/3D/새로고침/PNG/PDF 가 외부 설정 없이 항상 동작
 *  - crossOrigin/CORS 무관 (canvas taint 없음)
 *  - Firestore 문서 크기 한계를 고려해 긴 변 최대 1000px + 압축으로 용량을 제한
 */

/** Storage 설정 여부(참고용). v0.9.1 부터 렌더/업로드를 게이팅하지 않음 */
export const isStorageConfigured: boolean = isFirebaseConfigured && Boolean(firebaseConfig.storageBucket);

const ACCEPT = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

/** dataURL 용량 상한(문자 수 ≈ 바이트*1.37). Firestore 문서 1MiB 한계 고려 */
const MAX_DATAURL_LEN = 900_000;
/** 래스터 이미지 긴 변 최대 px */
const MAX_SIDE = 1000;
const MAX_SIDE_SMALL = 760;

export function isSupportedDesignFile(file: File): boolean {
  return ACCEPT.includes(file.type) || /\.(png|jpe?g|webp|svg)$/i.test(file.name);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 이미지 자연 크기 측정 */
function measure(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = url;
  });
}

/** 래스터 이미지를 경계 크기 dataURL 로 압축 (알파 보존 시 PNG, 아니면 JPEG) */
async function buildRasterDataUrl(file: File): Promise<{ url: string; w: number; h: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const hasAlpha = /png|webp/i.test(file.type) || /\.(png|webp)$/i.test(file.name);

    const encode = (maxSide: number, forceJpeg: boolean): { url: string; w: number; h: number } => {
      const scale = Math.min(1, maxSide / Math.max(iw, ih || 1));
      const cw = Math.max(1, Math.round(iw * scale));
      const ch = Math.max(1, Math.round((ih || iw) * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, cw, ch);
      const usePng = hasAlpha && !forceJpeg;
      const url = usePng ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.85);
      return { url, w: cw, h: ch };
    };

    let out = encode(MAX_SIDE, false);
    if (out.url.length > MAX_DATAURL_LEN) out = encode(MAX_SIDE, true); // JPEG 재인코딩
    if (out.url.length > MAX_DATAURL_LEN) out = encode(MAX_SIDE_SMALL, true); // 더 축소
    return out;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** SVG 는 텍스트 그대로 dataURL 로 (경량, 벡터 유지) */
async function buildSvgDataUrl(file: File): Promise<{ url: string; w: number; h: number }> {
  const text = await file.text();
  const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  const dim = await measure(url);
  return { url, w: dim.w, h: dim.h };
}

/**
 * 디자인 파일 → DesignAsset (자기완결 dataURL 참조).
 * 함수명은 하위 호환을 위해 유지(uploadDesignAsset).
 */
export async function uploadDesignAsset(file: File): Promise<DesignAsset> {
  const isSvg = /svg/i.test(file.type) || /\.svg$/i.test(file.name);
  const kind: DesignAsset['kind'] = isSvg ? 'svg' : 'raster';
  const { url, w, h } = isSvg ? await buildSvgDataUrl(file) : await buildRasterDataUrl(file);
  return {
    id: generateId(),
    name: file.name.replace(/\.[^.]+$/, ''),
    kind,
    url,
    widthPx: w || undefined,
    heightPx: h || undefined,
    createdAt: Date.now(),
  };
}

/**
 * 에셋 파일 삭제 — dataURL 방식은 배치안에 함께 저장되므로 별도 파일이 없습니다.
 * (과거 Storage 경로가 남아있는 자산 호환을 위해 시그니처만 유지, best-effort no-op)
 */
export async function deleteDesignAssetFile(_storagePath?: string): Promise<void> {
  void _storagePath;
  /* dataURL 자산은 삭제할 외부 파일 없음 */
}

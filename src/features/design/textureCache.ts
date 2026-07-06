/**
 * 텍스처(디자인 이미지) 로더 캐시 (v0.8.7, req #13).
 * 동일 URL 은 메모리에서 재사용하여 중복 로드를 막습니다. 2D/3D 공용.
 */

const cache = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

/** URL 로 텍스처 이미지를 로드(캐시). 실패 시 reject. */
export function loadTexture(url: string): Promise<HTMLImageElement> {
  const cached = cache.get(url);
  if (cached) return Promise.resolve(cached);
  const inflight = pending.get(url);
  if (inflight) return inflight;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Storage(CORS) 이미지도 캔버스에 사용 가능하게
    img.onload = () => {
      cache.set(url, img);
      pending.delete(url);
      resolve(img);
    };
    img.onerror = (e) => {
      pending.delete(url);
      reject(e);
    };
    img.src = url;
  });
  pending.set(url, p);
  return p;
}

/** 이미 로드된 텍스처 즉시 반환 (없으면 undefined) */
export function getCachedTexture(url: string): HTMLImageElement | undefined {
  return cache.get(url);
}

/** 여러 URL 을 미리 로드 (실패 무시) */
export async function preloadTextures(urls: string[]): Promise<void> {
  await Promise.all(urls.map((u) => loadTexture(u).catch(() => null)));
}

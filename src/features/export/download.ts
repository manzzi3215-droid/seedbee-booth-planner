/** 파일 시스템에서 문제되는 문자를 제거/치환 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'untitled';
}

/** 프로젝트명_배치안명 기반 파일 베이스명 */
export function buildBaseName(projectName: string, layoutName: string): string {
  return `${sanitizeFilename(projectName)}_${sanitizeFilename(layoutName)}`;
}

/** 이미지 dataURL 들을 미리 HTMLImageElement 로 로드 (export 렌더 전 준비) */
export async function preloadImages(srcList: string[]): Promise<Map<string, HTMLImageElement>> {
  const unique = Array.from(new Set(srcList));
  const map = new Map<string, HTMLImageElement>();
  await Promise.all(
    unique.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            map.set(src, img);
            resolve();
          };
          img.onerror = () => resolve(); // 실패해도 계속 (해당 이미지만 생략)
          img.src = src;
        }),
    ),
  );
  return map;
}

/** dataURL 을 파일로 다운로드 */
export function downloadDataURL(dataURL: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

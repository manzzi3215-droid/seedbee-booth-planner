/** 파일 시스템에서 문제되는 문자를 제거/치환 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim() || 'untitled';
}

/** 프로젝트명_배치안명 기반 파일 베이스명 */
export function buildBaseName(projectName: string, layoutName: string): string {
  return `${sanitizeFilename(projectName)}_${sanitizeFilename(layoutName)}`;
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

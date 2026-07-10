/**
 * 집기 치수 표기 공통 포맷터 (v1.2.4).
 * 모든 화면(2D 평면도 라벨 · 3D 미리보기 · PNG/PDF 출력)에서 동일한 문자열을 쓰도록 통일.
 *  - 높이(heightMm)가 유효하면  가로×세로×높이  (예: 1275×500×930)
 *  - 높이가 없으면(미설정)        가로×세로        (예: 1275×500)  — 임의의 0 은 표시하지 않음
 */
export function formatFixtureDims(
  widthMm: number,
  depthMm: number,
  heightMm?: number | null,
): string {
  const w = Math.round(widthMm);
  const d = Math.round(depthMm);
  if (heightMm != null && heightMm > 0) {
    return `${w}×${d}×${Math.round(heightMm)}`;
  }
  return `${w}×${d}`;
}

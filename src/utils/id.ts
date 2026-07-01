/**
 * 고유 ID 생성.
 * 브라우저의 crypto.randomUUID 를 사용하되, 미지원 환경 대비 폴백을 둡니다.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

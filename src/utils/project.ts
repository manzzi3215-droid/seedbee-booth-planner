import type { Project, ProjectVisibility } from '../types';

/**
 * 프로젝트의 "최근 수정" 시각.
 * project.updatedAt 과 모든 layout.updatedAt 중 최신값을 반환합니다.
 */
export function getProjectLastModified(project: Project): number {
  const layoutMax = project.layouts.reduce(
    (max, l) => Math.max(max, l.updatedAt),
    0,
  );
  return Math.max(project.updatedAt, layoutMax);
}

/** 공유 대상 이메일 목록 (하위 호환: 없으면 []) */
export function getSharedWith(project: Project): string[] {
  return project.sharedWith ?? [];
}

/** 공개 범위 (하위 호환: 없으면 sharedWith 유무로 판단, 기본 private) */
export function getVisibility(project: Project): ProjectVisibility {
  if (project.visibility) return project.visibility;
  return getSharedWith(project).length > 0 ? 'shared' : 'private';
}

/** 이메일 배열 정규화 (소문자/trim/중복 제거/빈값 제거) */
export function normalizeEmails(emails: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of emails) {
    const e = raw.trim().toLowerCase();
    if (e && !seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  return out;
}

/** 간단한 이메일 형식 검증 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

import type { Project } from '../types';

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

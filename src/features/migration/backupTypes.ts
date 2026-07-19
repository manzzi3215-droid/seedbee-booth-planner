/**
 * Firestore→Supabase 이전용 백업 JSON 스키마 (로컬 전용 도구).
 *
 * 보안: Firebase uid 전체·이메일·토큰·Firebase 설정값·Supabase uid 를 백업에 넣지 않습니다.
 *  - 각 Project JSON 에서 owner(Firebase uid)·sharedWith(이메일)는 내보낼 때 제거(비식별화).
 *  - 공유 링크 식별자(shareId/shareEnabled/sharePermission)는 PII 가 아니므로 보존.
 */
import type { Project, FixtureDef, Asset } from '../../types';

export const BACKUP_SCHEMA_VERSION = 1;

/** 프로젝트별 요약/검증 메타 */
export interface BackupProjectMeta {
  id: string;
  name: string;
  approxBytes: number;
  layoutCount: number;
  hasCreatedAt: boolean;
  hasUpdatedAt: boolean;
  hasDataUrl: boolean;
  glbLocalModelIds: string[];
  shareId?: string;
  shareEnabled?: boolean;
  sharePermission?: string;
}

/** 프로젝트별 공유 정보(토큰 보존용, PII 아님) */
export interface BackupShare {
  projectId: string;
  shareId: string;
  shareEnabled: boolean;
  sharePermission: string;
}

export interface BackupIntegrity {
  algo: 'sha256';
  checksum: string; // projects+libraries+shares 정본 JSON 의 SHA-256(hex)
  totalBytes: number; // 백업 payload 대략 크기
}

export interface FirebaseBackup {
  schemaVersion: number;
  exportedAt: string; // ISO 8601
  source: 'firebase';
  sourceProjectId: string; // Firebase projectId(설정값 아님, 프로젝트 식별자) — uid 아님
  ownerRef: string; // 비식별화된 소유자 참조(예: 'fb-…1234'). 전체 uid 아님
  projectCount: number;
  projects: Project[]; // 전체 Project JSON(단, owner/sharedWith 제거됨)
  libraries: { fixtures: FixtureDef[]; assets: Asset[] };
  shares: BackupShare[];
  projectMeta: BackupProjectMeta[];
  integrity: BackupIntegrity;
}

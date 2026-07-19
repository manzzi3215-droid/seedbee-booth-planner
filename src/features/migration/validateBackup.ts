/**
 * 백업 무결성 검증 (로컬 전용). 읽기/계산만 수행 — Firestore/Supabase 접근 없음.
 */
import type { FirebaseBackup } from './backupTypes';

/** SHA-256(hex) — Web Crypto */
export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 백업의 정본 문자열(무결성 계산 대상): projects + libraries + shares */
export function canonicalPayload(backup: Pick<FirebaseBackup, 'projects' | 'libraries' | 'shares'>): string {
  return JSON.stringify({ projects: backup.projects, libraries: backup.libraries, shares: backup.shares });
}

export interface ValidationCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface ValidationReport {
  ok: boolean;
  checks: ValidationCheck[];
  warnings: string[];
  glbLocalModelIds: string[];
  estimatedBytes: number;
}

/** dataURL 형식·디코드 가능 여부 확인(샘플) */
function dataUrlLooksValid(json: string): { found: boolean; valid: boolean } {
  const m = json.match(/data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]{16,})/);
  if (!m) return { found: /data:[a-z]+\//i.test(json), valid: true };
  try {
    atob(m[1].slice(0, 64)); // 앞부분 디코드 시도
    return { found: true, valid: true };
  } catch {
    return { found: true, valid: false };
  }
}

/** 백업 전체 검증 */
export async function validateBackup(backup: FirebaseBackup): Promise<ValidationReport> {
  const checks: ValidationCheck[] = [];
  const warnings: string[] = [];

  // 1) JSON stringify/parse 왕복
  let roundTripOk = false;
  try {
    const s = JSON.stringify(backup);
    const again = JSON.stringify(JSON.parse(s));
    roundTripOk = s === again;
  } catch {
    roundTripOk = false;
  }
  checks.push({ name: 'JSON 왕복(stringify/parse)', pass: roundTripOk, detail: roundTripOk ? '동일' : '불일치/직렬화 실패' });

  // 2) 프로젝트별 필수 필드
  let fieldsOk = true;
  for (const p of backup.projects) {
    const ok =
      typeof p.id === 'string' &&
      p.id.length > 0 &&
      typeof p.name === 'string' &&
      Array.isArray(p.layouts) &&
      typeof p.createdAt === 'number' &&
      typeof p.updatedAt === 'number';
    if (!ok) {
      fieldsOk = false;
      warnings.push(`프로젝트 필드 이상: ${p.name ?? p.id ?? '(unknown)'}`);
    }
  }
  checks.push({
    name: '프로젝트 필수 필드(id·name·layouts·createdAt·updatedAt)',
    pass: fieldsOk,
    detail: fieldsOk ? `${backup.projects.length}개 정상` : '일부 필드 누락',
  });

  // 3) projectCount 일치
  const countOk = backup.projectCount === backup.projects.length;
  checks.push({ name: 'projectCount 일치', pass: countOk, detail: `${backup.projectCount} vs ${backup.projects.length}` });

  // 4) dataURL 형식/디코드
  const du = dataUrlLooksValid(JSON.stringify(backup.projects));
  checks.push({
    name: 'dataURL 형식·디코드',
    pass: du.valid,
    detail: du.found ? (du.valid ? '유효(prefix+base64 디코드 OK)' : '디코드 실패(손상 가능)') : 'dataURL 없음',
  });

  // 5) shareId 중복
  const ids = backup.shares.map((s) => s.shareId).filter(Boolean);
  const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
  const dupOk = dup.length === 0;
  checks.push({ name: 'shareId 중복 없음', pass: dupOk, detail: dupOk ? '중복 없음' : `중복 ${dup.length}건` });

  // 6) 체크섬 재계산 일치
  const recomputed = await sha256Hex(canonicalPayload(backup));
  const checksumOk = recomputed === backup.integrity.checksum;
  checks.push({ name: 'SHA-256 체크섬 일치', pass: checksumOk, detail: checksumOk ? '일치' : '불일치' });

  // GLB localModelId 목록(경고)
  const glb: string[] = [];
  const scan = (obj: unknown) => {
    const json = JSON.stringify(obj);
    const re = /"localModelId"\s*:\s*"([^"]+)"/g;
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(json))) glb.push(mm[1]);
  };
  scan(backup.projects);
  scan(backup.libraries);
  const glbUnique = [...new Set(glb)];
  if (glbUnique.length > 0) {
    warnings.push(`GLB(localModelId) ${glbUnique.length}개는 기기 로컬(IndexedDB) 참조라 자동 이전 불가 — 대상 기기에서 재등록 필요`);
  }

  const estimatedBytes = new TextEncoder().encode(JSON.stringify(backup)).length;

  const ok = checks.every((c) => c.pass);
  return { ok, checks, warnings, glbLocalModelIds: glbUnique, estimatedBytes };
}

/**
 * Supabase 라이브러리 시드 잠금(seed_locked) — 클라우드 기준 기본 시드 차단.
 *
 * - supabase provider 에서만 의미. firebase/local 은 항상 false(기존 시드 동작 유지).
 * - 002 SQL(seed_locked 컬럼) 미적용 상태에서도 앱이 깨지지 않도록: 컬럼 없음(42703)이면 false 로 처리.
 * - 조회 실패(네트워크 등)는 **보수적으로 잠금(true)** → 클라우드 라이브러리를 기본 시드로 덮어쓰지 않음.
 * - 인터페이스(StorageProvider)는 변경하지 않고 Supabase 전용 모듈로 최소 확장.
 */
import { supabase } from './client';
import { ensureSupabaseAuth, verifySupabaseGoogleUser } from './auth';
import { storageProviderName } from '../storage/providerName';

function isMissingColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || /seed_locked/i.test(error.message ?? '');
}

/**
 * 현재 사용자의 seed_locked 여부.
 *  - 비-supabase: false
 *  - 컬럼 없음(002 전): false (기존 시드 동작)
 *  - true/false: 그대로
 *  - 그 외 오류: 보수적으로 true(시드 방지)
 */
export async function isLibrarySeedLocked(): Promise<boolean> {
  if (storageProviderName !== 'supabase' || !supabase) return false;
  try {
    const uid = await ensureSupabaseAuth();
    const { data, error } = await supabase
      .from('user_libraries')
      .select('seed_locked')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) {
      if (isMissingColumn(error)) return false; // 컬럼 미적용 → 기존 동작 유지
      return true; // 알 수 없는 오류 → 보수적 잠금
    }
    return (data as { seed_locked?: boolean } | null)?.seed_locked === true;
  } catch {
    return true; // 네트워크 등 실패 → 보수적 잠금
  }
}

export interface SeedLockResult {
  status: 'success' | 'verification_failed' | 'error';
  reason?: string;
  seedLocked?: boolean;
  userTail?: string | null;
}

/**
 * 현재 Google 사용자의 seed_locked=true 설정 + 재검증.
 *  - fixtures/assets 는 건드리지 않음(부분 upsert). 행이 이미 있어야 함(라이브러리 교체 완료 후 호출).
 *  - 비익명 Google + 세션 일치 확인. RLS 우회 없음(현재 uid 소유 행만).
 */
export async function setLibrarySeedLocked(): Promise<SeedLockResult> {
  if (!supabase) return { status: 'error', reason: 'Supabase 가 설정되지 않았습니다.' };
  try {
    const check = await verifySupabaseGoogleUser();
    if (!check.ok) return { status: 'error', reason: `로그인 확인 실패(${check.reason}).` };
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;

    const { error } = await supabase
      .from('user_libraries')
      .upsert({ user_id: uid, seed_locked: true }, { onConflict: 'user_id' });
    if (error) {
      if (isMissingColumn(error)) {
        return { status: 'error', reason: 'user_libraries.seed_locked 컬럼이 없습니다. 002 SQL 을 먼저 적용하세요.' };
      }
      return { status: 'error', reason: `저장 실패: ${error.message}` };
    }

    // 재검증
    const { data, error: e2 } = await supabase
      .from('user_libraries')
      .select('seed_locked')
      .eq('user_id', uid)
      .maybeSingle();
    const locked = (data as { seed_locked?: boolean } | null)?.seed_locked === true;
    if (e2 || !locked) {
      return { status: 'verification_failed', reason: '저장 후 seed_locked=true 재조회 실패', seedLocked: locked };
    }
    return { status: 'success', seedLocked: true, userTail: check.uidTail };
  } catch (e) {
    return { status: 'error', reason: (e as Error)?.message ?? String(e) };
  }
}

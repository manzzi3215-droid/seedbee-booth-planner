import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './client';
import { isSupabaseConfigured } from './config';

/**
 * Supabase 전용 인증(익명) 헬퍼.
 *
 * ⚠️ Firebase Auth 와 완전히 별개입니다. Supabase uid ≠ Firebase uid.
 *  - 앱 시작 시(VITE_STORAGE_PROVIDER=supabase) ensureSupabaseAuth() 로 익명 세션을 1회 확보.
 *  - 기존 세션이 있으면 재사용(중복 익명 사용자 생성 방지). 세션은 supabase-js 가 localStorage 에
 *    영속화하므로 새로고침 후에도 동일 uid 가 유지됩니다.
 *  - 이번 단계에서 Google 등 소셜 로그인은 구현하지 않습니다(익명만).
 */

export interface SupabaseAuthUser {
  uid: string;
  isAnonymous: boolean;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

function toUser(u: User): SupabaseAuthUser {
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
  return {
    uid: u.id,
    isAnonymous: u.is_anonymous ?? false,
    email: u.email ?? null,
    displayName: str(meta.full_name) ?? str(meta.name),
    photoURL: str(meta.avatar_url) ?? str(meta.picture),
  };
}

/**
 * OAuth 공통 옵션 — 최소 scope(email, profile)만 요청. Google API 접근 권한 없음.
 *
 * ⚠️ redirectTo 는 **경로(끝 슬래시 포함)**를 붙입니다. Supabase Redirect URLs 허용목록이
 * `http://localhost:5173/**` 형태라, 경로 없는 순수 origin(`http://localhost:5173`)은 매칭되지 않아
 * Site URL 로 폴백됩니다. 끝 슬래시를 붙여 origin 기반으로 정확히 매칭시킵니다.
 */
const oauthOptions = () => ({
  redirectTo: `${window.location.origin}/`,
  // 표준 OIDC 신원 스코프만(Google API 접근 없음). openid 가 있어야 id_token 에 이름/아바타 클레임이 포함되어
  // Supabase user_metadata(full_name/avatar_url)에 매핑됩니다.
  scopes: 'openid email profile',
});

/** 익명 세션이 확보된 uid 를 반환. Promise 를 캐시해 동시/중복 로그인을 방지. */
let bootstrapPromise: Promise<string> | null = null;

export function ensureSupabaseAuth(): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    return Promise.reject(new Error('Supabase 가 설정되지 않았습니다(VITE_SUPABASE_*).'));
  }
  if (!bootstrapPromise) {
    const client = supabase;
    bootstrapPromise = (async () => {
      // 1) 기존(영속) 세션 재사용
      const { data: sessionData } = await client.auth.getSession();
      const existing = sessionData.session?.user;
      if (existing) return existing.id;
      // 2) 없으면 익명 로그인
      const { data, error } = await client.auth.signInAnonymously();
      if (error || !data.user) {
        // 실패 시 다음 호출에서 재시도할 수 있도록 캐시 해제
        bootstrapPromise = null;
        throw error ?? new Error('Supabase 익명 로그인 실패');
      }
      return data.user.id;
    })();
  }
  return bootstrapPromise;
}

/**
 * 익명 사용자에 Google identity 연결(linkIdentity).
 *  - 현재(익명) uid 를 유지한 채 Google 계정을 연결 → 익명 상태에서 만든 projects/user_libraries 소유권 보존.
 *  - Google OAuth 로 리다이렉트되며, 복귀 후 supabase-js 가 세션을 복원합니다(PKCE + detectSessionInUrl).
 *  - ⚠️ Supabase "Manual Linking" 활성화 필요. 해당 Google 계정이 이미 다른 사용자에 연결돼 있으면
 *    복귀 콜백에서 실패(error_description) → 호출부에서 안내.
 */
export async function linkGoogleIdentity(): Promise<void> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다.');
  const { error } = await supabase.auth.linkIdentity({ provider: 'google', options: oauthOptions() });
  if (error) throw error;
  // 브라우저에서는 위 호출이 Google 로 자동 리다이렉트합니다.
}

/**
 * 기존 Google 계정으로 로그인(signInWithOAuth).
 *  - 로그아웃 후 "이미 등록된 Google 계정"으로 다시 로그인할 때 사용(익명 연결이 아님 → 해당 계정 uid 로 전환).
 */
export async function signInWithGoogleSupabase(): Promise<void> {
  if (!supabase) throw new Error('Supabase 가 설정되지 않았습니다.');
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: oauthOptions() });
  if (error) throw error;
}

/** 로그아웃 후 익명 세션을 다시 확보(앱은 계속 동작)하고 새로고침. */
export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  bootstrapPromise = null; // 다음 ensureSupabaseAuth 가 새 익명 세션을 만들도록 캐시 해제
  try {
    await ensureSupabaseAuth();
  } catch {
    /* 익명 로그인 실패해도 앱은 로컬로 계속 동작 */
  }
  window.location.reload();
}

/**
 * 현재(익명) 사용자에게 보존할 데이터(프로젝트 또는 라이브러리)가 있는지 확인.
 *  - "기존 Google 계정으로 로그인"은 uid 를 전환시키므로, 현재 게스트 데이터가 있으면 경고를 띄우기 위함.
 *  - 자동 병합/이전은 하지 않습니다(호출부에서 사용자 확인만).
 */
export async function currentUserHasData(): Promise<boolean> {
  if (!supabase) return false;
  const uid = await ensureSupabaseAuth();
  const [projects, lib] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('user_id', uid),
    supabase.from('user_libraries').select('fixtures, assets').eq('user_id', uid).maybeSingle(),
  ]);
  const projectCount = projects.count ?? 0;
  const fixtures = (lib.data?.fixtures ?? []) as unknown[];
  const assets = (lib.data?.assets ?? []) as unknown[];
  return projectCount > 0 || fixtures.length > 0 || assets.length > 0;
}

/** 현재 Supabase 세션(있으면). 인증을 트리거하지 않고 조회만 합니다. */
export async function getSupabaseSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}

/** 인증 상태 구독. 정리 함수를 반환합니다. (Supabase 미설정이면 즉시 null) */
export function subscribeSupabaseAuth(cb: (user: SupabaseAuthUser | null) => void): () => void {
  if (!supabase) {
    cb(null);
    return () => {};
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ? toUser(session.user) : null);
  });
  return () => data.subscription.unsubscribe();
}

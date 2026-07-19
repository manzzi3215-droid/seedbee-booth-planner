/**
 * Supabase 웹 설정 (환경 변수 기반).
 *
 * ⚠️ 자격 증명은 절대 소스에 하드코딩하지 않습니다.
 * Vite 환경 변수(VITE_SUPABASE_*)에서 읽으며, 값이 없으면 Supabase 를 사용하지 않습니다.
 *
 * VITE_SUPABASE_ANON_KEY 에는 publishable(공개용) 키를 넣습니다.
 * .env / .env.local 예시는 저장소의 .env.example 참고.
 */

const env = import.meta.env;

export const supabaseConfig = {
  url: env.VITE_SUPABASE_URL as string | undefined,
  anonKey: env.VITE_SUPABASE_ANON_KEY as string | undefined,
};

/**
 * URL·키가 모두 있으면 Supabase 사용 가능.
 * 하나라도 없으면 Supabase 를 초기화하지 않습니다.
 */
export const isSupabaseConfigured: boolean = Boolean(
  supabaseConfig.url && supabaseConfig.anonKey,
);

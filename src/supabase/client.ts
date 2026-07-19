/**
 * 앱 전역에서 사용하는 단일 Supabase 클라이언트 인스턴스.
 *
 * 환경 변수(VITE_SUPABASE_*)가 설정된 경우에만 생성되며,
 * 설정이 없으면 `supabase` 는 null 입니다(하위 호환).
 *
 * 사용 예: `import { supabase } from '@/supabase/client'`
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig, isSupabaseConfigured } from './config';

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseConfig.url as string, supabaseConfig.anonKey as string)
  : null;

export { isSupabaseConfigured };

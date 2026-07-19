import { isFirebaseConfigured } from '../firebase/config';
import { isSupabaseConfigured } from '../supabase/config';

/**
 * 저장소 provider 선택 (환경변수 기반).
 *
 * 이 모듈은 **provider 구현 클래스를 import 하지 않아** 순환 참조 없이
 * 어디서든(App/useAuthUser/AuthButton/ShareRoute) provider 종류를 안전하게 참조할 수 있습니다.
 *
 * VITE_STORAGE_PROVIDER 지원 값: 'firebase' | 'supabase' | 'local'
 *  - 기본값 firebase (하위 호환)
 *  - 선택한 클라우드 설정(env)이 없으면 안전하게 'local' 로 폴백
 */
export type StorageProviderName = 'firebase' | 'supabase' | 'local';

const raw = (import.meta.env.VITE_STORAGE_PROVIDER as string | undefined)?.trim().toLowerCase();

function resolve(): StorageProviderName {
  if (raw === 'local') return 'local';
  if (raw === 'supabase') return isSupabaseConfigured ? 'supabase' : 'local';
  // 'firebase' 또는 미지정/알 수 없는 값 → 기본 firebase(설정 없으면 local)
  return isFirebaseConfigured ? 'firebase' : 'local';
}

/** 실제로 선택된 provider 이름 */
export const storageProviderName: StorageProviderName = resolve();

/** 클라우드 저장소(firebase 또는 supabase) 사용 여부 — UI 상태 표시용 */
export const isCloudStorage: boolean =
  storageProviderName === 'firebase' || storageProviderName === 'supabase';

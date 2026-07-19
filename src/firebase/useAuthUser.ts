import { useEffect, useState } from 'react';
import { storageProviderName } from '../storage/providerName';
import { subscribeAuth, type AuthUser } from './auth';

/**
 * 현재 로그인 사용자(익명/Google) 상태 훅.
 * - provider 가 firebase 일 때만 Firebase Auth 를 초기화/구독합니다.
 *   (supabase/local provider 에서는 Firebase 를 불필요하게 초기화하지 않음) → 항상 null + ready.
 */
export function useAuthUser(): { user: AuthUser | null; ready: boolean; cloud: boolean } {
  const active = storageProviderName === 'firebase';
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!active);

  useEffect(() => {
    if (!active) return;
    const unsub = subscribeAuth((u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, [active]);

  return { user, ready, cloud: active };
}

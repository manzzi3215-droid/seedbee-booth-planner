import { useEffect, useState } from 'react';
import { isFirebaseConfigured } from './config';
import { subscribeAuth, type AuthUser } from './auth';

/**
 * 현재 로그인 사용자(익명/Google) 상태 훅.
 * - Firebase 미설정(LocalStorage 전용)이면 항상 null + ready.
 */
export function useAuthUser(): { user: AuthUser | null; ready: boolean; cloud: boolean } {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsub = subscribeAuth((u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);

  return { user, ready, cloud: isFirebaseConfigured };
}

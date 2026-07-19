import { useEffect, useState } from 'react';
import { storageProviderName } from '../storage/providerName';
import { subscribeSupabaseAuth, type SupabaseAuthUser } from './auth';

/**
 * 현재 Supabase 익명 사용자 상태 훅.
 * - provider 가 supabase 가 아니면 항상 null + ready(구독하지 않음).
 * - Firebase 의 useAuthUser 와 형태(반환 shape)를 맞춰 UI 에서 최소 분기로 사용.
 */
export function useSupabaseAuthUser(): { user: SupabaseAuthUser | null; ready: boolean; cloud: boolean } {
  const active = storageProviderName === 'supabase';
  const [user, setUser] = useState<SupabaseAuthUser | null>(null);
  const [ready, setReady] = useState(!active);

  useEffect(() => {
    if (!active) return;
    const unsub = subscribeSupabaseAuth((u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, [active]);

  return { user, ready, cloud: active };
}

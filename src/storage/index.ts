import type { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { FirestoreStorageProvider } from './FirestoreStorageProvider';
import { SupabaseStorageProvider } from './SupabaseStorageProvider';
import { storageProviderName, isCloudStorage } from './providerName';

/**
 * 앱 전역에서 사용하는 단일 storage 인스턴스.
 *
 * provider 선택은 VITE_STORAGE_PROVIDER(firebase|supabase|local) 로 결정됩니다(providerName.ts).
 *  - firebase : Firestore + LocalStorage 캐시 (기존 동작)
 *  - supabase : Supabase(Postgres) + LocalStorage 캐시
 *  - local    : LocalStorage 전용
 *  - 선택한 클라우드 설정(env)이 없으면 자동으로 local 로 폴백
 *
 * 나머지 앱 코드는 항상 `import { storage } from '@/storage'` 로만 접근하세요.
 */
export const storage: StorageProvider =
  storageProviderName === 'supabase'
    ? new SupabaseStorageProvider()
    : storageProviderName === 'firebase'
      ? new FirestoreStorageProvider()
      : new LocalStorageProvider();

/** 클라우드(firebase|supabase) 저장소 사용 중 여부 — UI 상태 표시용 */
export { isCloudStorage, storageProviderName };
export type { StorageProviderName } from './providerName';

export type { StorageProvider } from './StorageProvider';

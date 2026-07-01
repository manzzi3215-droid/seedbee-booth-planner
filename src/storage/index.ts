import type { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';

/**
 * 앱 전역에서 사용하는 단일 storage 인스턴스.
 *
 * 👉 나중에 Firebase 로 바꾸려면 이 한 줄만 교체하면 됩니다:
 *      export const storage: StorageProvider = new FirestoreStorageProvider();
 *
 * 나머지 앱 코드는 항상 `import { storage } from '@/storage'` 로만 접근하세요.
 */
export const storage: StorageProvider = new LocalStorageProvider();

export type { StorageProvider } from './StorageProvider';

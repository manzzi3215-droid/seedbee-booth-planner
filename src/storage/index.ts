import type { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { FirestoreStorageProvider } from './FirestoreStorageProvider';
import { isFirebaseConfigured } from '../firebase/config';

/**
 * 앱 전역에서 사용하는 단일 storage 인스턴스.
 *
 * - Firebase 설정(VITE_FIREBASE_*)이 있으면 Firestore 를 기본 저장소로 사용하고
 *   LocalStorage 를 캐시/백업/오프라인 폴백으로 씁니다.
 * - 설정이 없으면 기존과 동일하게 LocalStorage 전용으로 동작합니다(하위 호환).
 *
 * 나머지 앱 코드는 항상 `import { storage } from '@/storage'` 로만 접근하세요.
 */
export const storage: StorageProvider = isFirebaseConfigured
  ? new FirestoreStorageProvider()
  : new LocalStorageProvider();

/** Firestore(클라우드) 저장소 사용 중 여부 — UI 상태 표시용 */
export const isCloudStorage = isFirebaseConfigured;

export type { StorageProvider } from './StorageProvider';

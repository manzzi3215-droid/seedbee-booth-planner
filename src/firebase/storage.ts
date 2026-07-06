import { firebaseConfig, isFirebaseConfigured } from './config';
import { getFirebase } from './app';
import { generateId } from '../utils/id';
import type { DesignAsset } from '../types';

/**
 * Firebase Storage 업로드 (Design Mapping v0.8.7).
 * 이미지 바이트는 Storage 에, Firestore/레이아웃에는 참조(URL)만 저장합니다(Base64 금지).
 * storageBucket 미설정 시 업로드는 비활성(호출부에서 isStorageConfigured 로 확인).
 */

/** Storage 사용 가능 여부 (Firebase 설정 + storageBucket 존재) */
export const isStorageConfigured: boolean = isFirebaseConfigured && Boolean(firebaseConfig.storageBucket);

const ACCEPT = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

export function isSupportedDesignFile(file: File): boolean {
  return ACCEPT.includes(file.type) || /\.(png|jpe?g|webp|svg)$/i.test(file.name);
}

/** 이미지 자연 크기 측정 */
function measure(url: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = url;
  });
}

/**
 * 디자인 파일을 Firebase Storage 에 업로드하고 DesignAsset(참조) 반환.
 * @param file  이미지 파일
 * @param ownerUid  현재 사용자 uid (경로 격리)
 */
export async function uploadDesignAsset(file: File): Promise<DesignAsset> {
  if (!isStorageConfigured) {
    throw new Error('Firebase Storage 가 설정되지 않았습니다(VITE_FIREBASE_STORAGE_BUCKET).');
  }
  const { app, uid } = await getFirebase();
  const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
  const storage = getStorage(app);
  const id = generateId();
  const safeName = file.name.replace(/[^\w.\-가-힣]/g, '_');
  const storagePath = `designs/${uid}/${id}_${safeName}`;
  const sref = ref(storage, storagePath);
  await uploadBytes(sref, file, { contentType: file.type || 'application/octet-stream' });
  const url = await getDownloadURL(sref);
  const kind: DesignAsset['kind'] = /svg/i.test(file.type) || /\.svg$/i.test(file.name) ? 'svg' : 'raster';
  const dim = kind === 'raster' ? await measure(url) : { w: 0, h: 0 };
  return {
    id,
    name: file.name.replace(/\.[^.]+$/, ''),
    kind,
    url,
    storagePath,
    widthPx: dim.w || undefined,
    heightPx: dim.h || undefined,
    createdAt: Date.now(),
  };
}

/** Storage 에서 에셋 삭제 (best-effort) */
export async function deleteDesignAssetFile(storagePath?: string): Promise<void> {
  if (!isStorageConfigured || !storagePath) return;
  try {
    const { app } = await getFirebase();
    const { getStorage, ref, deleteObject } = await import('firebase/storage');
    await deleteObject(ref(getStorage(app), storagePath));
  } catch {
    /* 이미 삭제되었거나 권한 문제 — 무시 */
  }
}

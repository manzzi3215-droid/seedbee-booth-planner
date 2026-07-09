import { getFirebase } from './app';
import { isFirebaseConfigured } from './config';

/**
 * 3D 모델(GLB/GLTF) 파일 저장 (v1.1.5).
 *
 * - 이미지(디자인 에셋)와 달리 모델은 수 MB 라 Firestore 문서(1MiB)에 담을 수 없습니다.
 * - 공유(다른 사용자/기기)를 위해 Firebase Storage 에 업로드하고 다운로드 URL 을 집기 정의에 저장합니다.
 * - 업로더 브라우저에서는 IndexedDB 에 원본 blob 을 캐시해 즉시/오프라인 렌더가 가능합니다.
 * - 렌더 시: IndexedDB 캐시 → 없으면 Storage URL fetch → 실패 시 placeholder(호출부에서 처리).
 */

const IDB_NAME = 'blp-models';
const IDB_STORE = 'models';

function openIdb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbPut(key: string, data: ArrayBuffer): Promise<void> {
  const db = await openIdb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(data, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
  db.close();
}

async function idbGet(key: string): Promise<ArrayBuffer | null> {
  const db = await openIdb();
  if (!db) return null;
  const out = await new Promise<ArrayBuffer | null>((resolve) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result as ArrayBuffer) ?? null);
    req.onerror = () => resolve(null);
  });
  db.close();
  return out;
}

export function isSupportedModelFile(file: File): boolean {
  return /\.(glb|gltf)$/i.test(file.name);
}

/** 최대 모델 파일 크기(20MB) */
export const MAX_MODEL_BYTES = 20 * 1024 * 1024;

/**
 * 모델 파일 업로드 → Storage 다운로드 URL 반환. 동시에 IndexedDB 에 원본 캐시.
 * Storage 설정이 없거나 실패하면 URL 없이 로컬 캐시만 하고 null 반환.
 */
export async function uploadModelFile(
  file: File,
  defId: string,
): Promise<{ url: string | null; cached: boolean }> {
  const buf = await file.arrayBuffer();
  // 업로더 로컬 캐시 (항상 시도)
  let cached = false;
  try {
    await idbPut(defId, buf);
    cached = true;
  } catch {
    /* 무시 */
  }

  if (!isFirebaseConfigured) return { url: null, cached };
  try {
    const { app, uid } = await getFirebase();
    const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const storage = getStorage(app);
    const ext = /\.gltf$/i.test(file.name) ? 'gltf' : 'glb';
    const path = `models/${uid}/${defId}.${ext}`;
    const r = ref(storage, path);
    await uploadBytes(r, file, { contentType: file.type || 'model/gltf-binary' });
    const url = await getDownloadURL(r);
    return { url, cached };
  } catch (e) {
    console.error('[modelStorage] Storage upload failed', e);
    return { url: null, cached };
  }
}

/**
 * 렌더용 모델 데이터 로드. IndexedDB 캐시 우선 → Storage URL fetch → 실패 시 null.
 * 반환된 ArrayBuffer 는 GLTFLoader.parse 로 사용.
 */
export async function loadModelBuffer(defId: string, url?: string): Promise<ArrayBuffer | null> {
  const cached = await idbGet(defId);
  if (cached) return cached;
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    void idbPut(defId, buf); // 다음 렌더를 위해 캐시
    return buf;
  } catch (e) {
    console.error('[modelStorage] fetch model failed', e);
    return null;
  }
}

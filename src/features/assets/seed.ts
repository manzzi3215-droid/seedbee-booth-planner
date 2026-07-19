import type { Asset } from '../../types';
import { storage } from '../../storage';
import { generateId } from '../../utils/id';
import { DEFAULT_ASSETS } from './defaults';
import { isLibrarySeedLocked } from '../../supabase/libraryLock';

/**
 * 에셋 라이브러리가 비어 있으면 기본 샘플 에셋을 자동 생성한다(v0.9.7).
 * 반환값은 (필요 시 시드된) 최종 에셋 목록.
 *
 * ⚠️ storage provider 만 사용한다(localStorage 직접 호출 금지).
 * 동시성: StrictMode 이중 실행 대비 모듈 레벨 잠금으로 한 번만 시드.
 */
let seedingPromise: Promise<void> | null = null;

/**
 * 시드 버전 플래그 (기기 단위). 버전을 올리면 기존 라이브러리에 "이름 기준으로 없는" 기본 에셋을
 * 한 번만 top-up 합니다. (삭제한 에셋을 매번 되살리지 않도록 버전 플래그로 1회만 실행)
 *   v2: v0.9.8 Furniture/Decoration 에셋 확장
 */
const SEED_VERSION_KEY = 'blp:assetSeedVersion';
const SEED_VERSION = 2;

async function seedIfEmpty(): Promise<void> {
  // 클라우드 시드 잠금(마이그레이션 완료 사용자) → 기본 시드/ top-up 추가 안 함(모든 기기 기준).
  if (await isLibrarySeedLocked()) return;
  const existing = await storage.getAssets();
  const now = Date.now();

  if (existing.length === 0) {
    for (const seed of DEFAULT_ASSETS) {
      await storage.saveAsset({ ...seed, id: generateId(), createdAt: now, updatedAt: now });
    }
    try { localStorage.setItem(SEED_VERSION_KEY, String(SEED_VERSION)); } catch { /* 무시 */ }
    return;
  }

  // 기존 라이브러리 top-up (1회): 새로 추가된 기본 에셋을 이름 기준으로 보충
  let done = 1;
  try { done = Number(localStorage.getItem(SEED_VERSION_KEY) || '1'); } catch { /* 무시 */ }
  if (done >= SEED_VERSION) return;
  const names = new Set(existing.map((a) => a.name));
  for (const seed of DEFAULT_ASSETS) {
    if (!names.has(seed.name)) {
      await storage.saveAsset({ ...seed, id: generateId(), createdAt: now, updatedAt: now });
    }
  }
  try { localStorage.setItem(SEED_VERSION_KEY, String(SEED_VERSION)); } catch { /* 무시 */ }
}

export async function ensureDefaultAssets(): Promise<Asset[]> {
  if (!seedingPromise) {
    // 실패 시 다음 호출에서 재시도할 수 있도록 rejected promise 를 캐시하지 않음
    seedingPromise = seedIfEmpty().catch((e) => {
      seedingPromise = null;
      throw e;
    });
  }
  await seedingPromise;
  return storage.getAssets();
}

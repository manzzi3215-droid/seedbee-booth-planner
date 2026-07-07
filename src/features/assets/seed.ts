import type { Asset } from '../../types';
import { storage } from '../../storage';
import { generateId } from '../../utils/id';
import { DEFAULT_ASSETS } from './defaults';

/**
 * 에셋 라이브러리가 비어 있으면 기본 샘플 에셋을 자동 생성한다(v0.9.7).
 * 반환값은 (필요 시 시드된) 최종 에셋 목록.
 *
 * ⚠️ storage provider 만 사용한다(localStorage 직접 호출 금지).
 * 동시성: StrictMode 이중 실행 대비 모듈 레벨 잠금으로 한 번만 시드.
 */
let seedingPromise: Promise<void> | null = null;

async function seedIfEmpty(): Promise<void> {
  const existing = await storage.getAssets();
  if (existing.length > 0) return;
  const now = Date.now();
  for (const seed of DEFAULT_ASSETS) {
    await storage.saveAsset({ ...seed, id: generateId(), createdAt: now, updatedAt: now });
  }
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

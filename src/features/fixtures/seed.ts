import type { FixtureDef } from '../../types';
import { storage } from '../../storage';
import { generateId } from '../../utils/id';
import { DEFAULT_FIXTURES } from './defaults';

/**
 * 집기 라이브러리가 비어 있으면 기본 집기를 자동 생성한다.
 * 반환값은 (필요 시 시드된) 최종 집기 목록.
 *
 * ⚠️ storage provider 만 사용한다(localStorage 직접 호출 금지).
 *
 * 동시성 주의: React StrictMode 는 effect 를 두 번 실행하므로
 * ensureDefaultFixtures 가 거의 동시에 두 번 호출될 수 있다. 모듈 레벨 잠금으로
 * 시드 작업이 정확히 한 번만 실행되도록 보장한다(중복 생성 방지).
 */
let seedingPromise: Promise<void> | null = null;

async function seedIfEmpty(): Promise<void> {
  const existing = await storage.getFixtures();
  if (existing.length > 0) return;
  for (const seed of DEFAULT_FIXTURES) {
    await storage.saveFixture({ ...seed, id: generateId() });
  }
}

export async function ensureDefaultFixtures(): Promise<FixtureDef[]> {
  if (!seedingPromise) {
    seedingPromise = seedIfEmpty();
  }
  await seedingPromise;
  return storage.getFixtures();
}

import { useCallback, useEffect, useState } from 'react';
import type { FixtureDef } from '../../types';
import { storage } from '../../storage';
import { ensureDefaultFixtures } from './seed';

/**
 * 집기 라이브러리 상태 관리 훅.
 * 최초 로드 시 기본 집기를 시드하고, 저장/삭제 후 재조회를 제공합니다.
 */
export function useFixtures() {
  const [fixtures, setFixtures] = useState<FixtureDef[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setFixtures(await storage.getFixtures());
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const list = await ensureDefaultFixtures();
      if (active) {
        setFixtures(list);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveFixture = useCallback(
    async (fixture: FixtureDef) => {
      await storage.saveFixture(fixture);
      await reload();
    },
    [reload],
  );

  const deleteFixture = useCallback(
    async (id: string) => {
      await storage.deleteFixture(id);
      await reload();
    },
    [reload],
  );

  // 순서 정규화(v1.1.3) — 주어진 id 순서대로 order 를 0,1,2… 로 재부여하고,
  // 전체 라이브러리를 "한 번의 문서 쓰기"로 원자적 저장(병렬 저장 경쟁 제거) 후 재조회.
  // orderedIds 에 없는 집기가 있으면 뒤에 붙여 유실을 방지합니다.
  const reorderFixtures = useCallback(
    async (orderedIds: string[]) => {
      const map = new Map(fixtures.map((f) => [f.id, f]));
      const seen = new Set(orderedIds);
      const inOrder = orderedIds.map((id) => map.get(id)).filter((f): f is FixtureDef => !!f);
      const rest = fixtures.filter((f) => !seen.has(f.id)); // 방어적: 누락분 뒤에 유지
      const next = [...inOrder, ...rest].map((f, i) => ({ ...f, order: i }));
      await storage.saveFixtures(next);
      await reload();
    },
    [fixtures, reload],
  );

  return { fixtures, loading, saveFixture, deleteFixture, reorderFixtures };
}

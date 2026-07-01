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

  return { fixtures, loading, saveFixture, deleteFixture };
}

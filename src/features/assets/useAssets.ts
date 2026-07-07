import { useCallback, useEffect, useState } from 'react';
import type { Asset } from '../../types';
import { storage } from '../../storage';
import { ensureDefaultAssets } from './seed';

const RECENT_KEY = 'blp:assetRecent';
const RECENT_MAX = 12;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * 에셋 라이브러리 상태 관리 훅 (v0.9.7).
 * 최초 로드 시 기본 샘플 에셋을 시드하고, 저장/삭제 후 재조회 및 최근 사용 기록을 제공합니다.
 */
export function useAssets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentIds, setRecentIds] = useState<string[]>(readRecent);

  const reload = useCallback(async () => {
    setAssets(await storage.getAssets());
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let list: Asset[] = [];
      try {
        list = await ensureDefaultAssets();
      } catch {
        // 시드/클라우드 실패 시에도 로컬 캐시로 폴백 (패널이 비어 멈추지 않도록)
        try {
          list = await storage.getAssets();
        } catch {
          list = [];
        }
      }
      if (active) {
        setAssets(list);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const saveAsset = useCallback(
    async (asset: Asset) => {
      await storage.saveAsset(asset);
      await reload();
    },
    [reload],
  );

  const deleteAsset = useCallback(
    async (id: string) => {
      await storage.deleteAsset(id);
      await reload();
    },
    [reload],
  );

  const toggleFavorite = useCallback(
    async (id: string) => {
      const target = assets.find((a) => a.id === id);
      if (!target) return;
      await saveAsset({ ...target, favorite: !target.favorite, updatedAt: Date.now() });
    },
    [assets, saveAsset],
  );

  const togglePin = useCallback(
    async (id: string) => {
      const target = assets.find((a) => a.id === id);
      if (!target) return;
      await saveAsset({ ...target, pinned: !target.pinned, updatedAt: Date.now() });
    },
    [assets, saveAsset],
  );

  const markRecent = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* 저장 실패 무시 */
      }
      return next;
    });
  }, []);

  return { assets, loading, reload, saveAsset, deleteAsset, toggleFavorite, togglePin, recentIds, markRecent };
}

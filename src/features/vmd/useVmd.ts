import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Product, Project, VmdBoard, VmdElement, VmdPreset } from '../../types';
import { storage } from '../../storage';
import { generateId } from '../../utils/id';
import { createBoard } from './vmdModel';

/**
 * VMD Board Workspace 상태 관리 (v1.0.1).
 * 프로젝트를 로드해 vmdBoards/vmdPresets 를 편집하고, 디바운스 자동 저장 + Undo/Redo 를 제공.
 * 부스 편집과 완전히 분리되어 있어 기존 기능에 영향이 없습니다.
 */
export function useVmd(projectId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState<VmdBoard[]>([]);
  const [presets, setPresets] = useState<VmdPreset[]>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  const past = useRef<VmdBoard[][]>([]);
  const future = useRef<VmdBoard[][]>([]);
  const [histV, setHistV] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  // 로드
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    (async () => {
      setLoading(true);
      const p = await storage.getProject(projectId);
      if (!active) return;
      setProject(p);
      const bs = p?.vmdBoards ?? [];
      setBoards(bs);
      setPresets(p?.vmdPresets ?? []);
      setCurrentBoardId(bs[0]?.id ?? null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  const products: Product[] = project?.products ?? [];
  const currentBoard = useMemo(() => boards.find((b) => b.id === currentBoardId) ?? null, [boards, currentBoardId]);

  // 저장 (디바운스 2초)
  const scheduleSave = useCallback(
    (nextBoards: VmdBoard[], nextPresets: VmdPreset[]) => {
      if (!project) return;
      dirty.current = true;
      setSaveState('saving');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const updated: Project = { ...project, vmdBoards: nextBoards, vmdPresets: nextPresets, updatedAt: Date.now() };
        try {
          await storage.saveProject(updated);
          setProject(updated);
          setSaveState('saved');
          dirty.current = false;
        } catch {
          setSaveState('idle');
        }
      }, 2000);
    },
    [project],
  );

  // 히스토리 커밋 후 boards 반영 + 저장
  const commit = useCallback(
    (updater: (prev: VmdBoard[]) => VmdBoard[], opts?: { history?: boolean }) => {
      setBoards((prev) => {
        const next = updater(prev);
        if (next === prev) return prev;
        if (opts?.history !== false) {
          past.current.push(prev.map((b) => structuredClone(b)));
          if (past.current.length > 40) past.current.shift();
          future.current = [];
          setHistV((v) => v + 1);
        }
        scheduleSave(next, presets);
        return next;
      });
    },
    [presets, scheduleSave],
  );

  const patchBoard = useCallback(
    (boardId: string, patch: Partial<VmdBoard>) =>
      commit((prev) => prev.map((b) => (b.id === boardId ? { ...b, ...patch, updatedAt: Date.now() } : b))),
    [commit],
  );

  const patchCurrentBoard = useCallback(
    (patch: Partial<VmdBoard>) => currentBoardId && patchBoard(currentBoardId, patch),
    [currentBoardId, patchBoard],
  );

  // ----- 보드 -----
  const addBoard = useCallback(
    (board?: VmdBoard) => {
      const b = board ?? createBoard();
      commit((prev) => [...prev, b], { history: false });
      setCurrentBoardId(b.id);
      setSelectedIds([]);
      return b;
    },
    [commit],
  );
  const deleteBoard = useCallback(
    (boardId: string) => {
      commit((prev) => prev.filter((b) => b.id !== boardId), { history: false });
      setCurrentBoardId((cur) => (cur === boardId ? boards.find((b) => b.id !== boardId)?.id ?? null : cur));
    },
    [commit, boards],
  );

  // ----- 요소 -----
  const setElements = useCallback(
    (fn: (els: VmdElement[]) => VmdElement[]) => {
      if (!currentBoardId) return;
      commit((prev) => prev.map((b) => (b.id === currentBoardId ? { ...b, elements: fn(b.elements), updatedAt: Date.now() } : b)));
    },
    [currentBoardId, commit],
  );
  const addElement = useCallback(
    (el: VmdElement) => {
      setElements((els) => [...els, el]);
      setSelectedIds([el.id]);
    },
    [setElements],
  );
  const updateElement = useCallback(
    (id: string, patch: Partial<VmdElement>) => setElements((els) => els.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    [setElements],
  );
  const removeElements = useCallback(
    (ids: string[]) => {
      const set = new Set(ids);
      setElements((els) => els.filter((e) => !set.has(e.id)));
      setSelectedIds([]);
    },
    [setElements],
  );
  const duplicateElements = useCallback(
    (ids: string[]) => {
      const set = new Set(ids);
      const newIds: string[] = [];
      setElements((els) => {
        const dups = els.filter((e) => set.has(e.id)).map((e) => {
          const nid = generateId();
          newIds.push(nid);
          return { ...e, id: nid, xMm: e.xMm + 20, yMm: e.yMm + 20, name: `${e.name} 복사` };
        });
        return [...els, ...dups];
      });
      setSelectedIds(newIds);
    },
    [setElements],
  );
  /** z-order: 배열 순서 = 렌더 순서(뒤→앞). up=앞으로, down=뒤로 */
  const reorderElement = useCallback(
    (id: string, dir: 'up' | 'down' | 'top' | 'bottom') =>
      setElements((els) => {
        const i = els.findIndex((e) => e.id === id);
        if (i < 0) return els;
        const arr = [...els];
        const [item] = arr.splice(i, 1);
        if (dir === 'up') arr.splice(Math.min(arr.length, i + 1), 0, item);
        else if (dir === 'down') arr.splice(Math.max(0, i - 1), 0, item);
        else if (dir === 'top') arr.push(item);
        else arr.unshift(item);
        return arr;
      }),
    [setElements],
  );

  // ----- Undo / Redo -----
  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    const prev = past.current.pop()!;
    future.current.push(boards.map((b) => structuredClone(b)));
    setBoards(prev);
    scheduleSave(prev, presets);
    setSelectedIds([]);
    setHistV((v) => v + 1);
  }, [boards, presets, scheduleSave]);
  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    const next = future.current.pop()!;
    past.current.push(boards.map((b) => structuredClone(b)));
    setBoards(next);
    scheduleSave(next, presets);
    setSelectedIds([]);
    setHistV((v) => v + 1);
  }, [boards, presets, scheduleSave]);

  // ----- Preset -----
  const savePreset = useCallback(
    (name: string) => {
      if (!currentBoard) return;
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = currentBoard;
      const preset: VmdPreset = { id: generateId(), name, board: structuredClone(rest), createdAt: Date.now() };
      const next = [...presets, preset];
      setPresets(next);
      scheduleSave(boards, next);
    },
    [currentBoard, presets, boards, scheduleSave],
  );
  const loadPreset = useCallback(
    (presetId: string) => {
      const p = presets.find((x) => x.id === presetId);
      if (!p) return;
      const board: VmdBoard = { ...structuredClone(p.board), id: generateId(), createdAt: Date.now(), updatedAt: Date.now() };
      addBoard(board);
    },
    [presets, addBoard],
  );
  const deletePreset = useCallback(
    (presetId: string) => {
      const next = presets.filter((x) => x.id !== presetId);
      setPresets(next);
      scheduleSave(boards, next);
    },
    [presets, boards, scheduleSave],
  );

  return {
    loading,
    project,
    products,
    boards,
    presets,
    currentBoard,
    currentBoardId,
    setCurrentBoardId,
    selectedIds,
    setSelectedIds,
    saveState,
    // boards
    addBoard,
    deleteBoard,
    patchBoard,
    patchCurrentBoard,
    // elements
    addElement,
    updateElement,
    removeElements,
    duplicateElements,
    reorderElement,
    setElements,
    // history
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    histV,
    // preset
    savePreset,
    loadPreset,
    deletePreset,
  };
}

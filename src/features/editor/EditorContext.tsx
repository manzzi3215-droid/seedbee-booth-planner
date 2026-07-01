import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import type { FixtureDef, Layout, PlacedFixture, Project } from '../../types';
import { storage } from '../../storage';
import { generateId } from '../../utils/id';
import { useFixtures } from '../fixtures/useFixtures';
import { snapMmToGrid } from '../canvas/coords';
import { DEFAULT_GRID_SIZE_MM } from '../canvas/constants';

/**
 * 편집기 전역 상태.
 *
 * 세 영역(집기 라이브러리 / 캔버스 / 선택 정보 패널)이 배치 상태를 공유해야 하므로
 * Context 로 묶습니다. 배치 좌표는 모두 mm, 회전은 degree 기준입니다.
 *
 * 배치(placed)는 배치안(Layout)으로 저장/불러오기 됩니다.
 */
interface EditorContextValue {
  // 프로젝트
  project: Project | null;
  projectLoading: boolean;

  // 배치안(Layout) 버전 관리
  layouts: Layout[];
  currentLayoutId: string | null;
  /** 현재 배치가 저장된 배치안과 달라 저장이 필요한 상태 */
  dirty: boolean;
  /** 현재(선택된) 배치안에 저장. 없으면 v1 자동 생성 */
  saveCurrent: () => Promise<void>;
  /** 현재 배치를 새 이름의 배치안으로 저장하고 선택 */
  saveAs: (name: string) => Promise<void>;
  /** 배치안을 캔버스로 불러오기 */
  loadLayout: (layoutId: string) => void;
  /** 새 배치안 이름 기본 제안값 (v1, v2, ...) */
  suggestLayoutName: () => string;

  // 집기 라이브러리
  fixtures: FixtureDef[];
  fixturesLoading: boolean;
  fixturesById: Map<string, FixtureDef>;
  saveFixture: (f: FixtureDef) => Promise<void>;
  deleteFixture: (id: string) => Promise<void>;

  // 배치
  placed: PlacedFixture[];
  selectedId: string | null;
  gridSizeMm: number;

  place: (def: FixtureDef) => void;
  select: (id: string | null) => void;
  move: (id: string, xMm: number, yMm: number) => void;
  rotateSelected: () => void;
  copySelected: () => void;
  deleteSelected: () => void;
  /** 선택 집기를 delta(mm)만큼 이동 (스냅하지 않음 — 방향키 미세 이동용) */
  nudgeSelected: (dxMm: number, dyMm: number) => void;
  /** 선택 집기 위치를 직접 지정 (mm, 스냅하지 않음) */
  setSelectedPosition: (xMm: number, yMm: number) => void;
  /** 선택 집기 회전을 직접 지정 (deg, 0~359 정규화) */
  setSelectedRotation: (deg: number) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within <EditorProvider>');
  return ctx;
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const { projectId } = useParams();

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  const { fixtures, loading: fixturesLoading, saveFixture, deleteFixture } =
    useFixtures();

  const [placed, setPlaced] = useState<PlacedFixture[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gridSizeMm] = useState(DEFAULT_GRID_SIZE_MM);

  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null);

  // 배치 스냅샷 복제(참조 공유 방지)
  const clonePlaced = (list: PlacedFixture[]): PlacedFixture[] =>
    list.map((p) => ({ ...p }));

  // 프로젝트 + 배치안 로드. 가장 최근 수정된 배치안을 자동으로 캔버스에 불러옴.
  useEffect(() => {
    let active = true;
    (async () => {
      setProjectLoading(true);
      const found = projectId ? await storage.getProject(projectId) : null;
      if (!active) return;

      setProject(found);
      const projectLayouts = found?.layouts ?? [];
      setLayouts(projectLayouts);

      const latest =
        projectLayouts.length > 0
          ? projectLayouts.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
          : null;
      setPlaced(latest ? clonePlaced(latest.placedFixtures) : []);
      setCurrentLayoutId(latest?.id ?? null);
      setSelectedId(null);
      setProjectLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  const fixturesById = useMemo(
    () => new Map(fixtures.map((f) => [f.id, f])),
    [fixtures],
  );

  const value = useMemo<EditorContextValue>(() => {
    const boothW = project?.boothConfig.widthMm ?? 0;
    const boothD = project?.boothConfig.depthMm ?? 0;

    const place = (def: FixtureDef) => {
      // 부스 중앙에 집기 중심을 맞춰 배치 후 그리드 스냅
      const x = snapMmToGrid(boothW / 2 - def.widthMm / 2, gridSizeMm);
      const y = snapMmToGrid(boothD / 2 - def.depthMm / 2, gridSizeMm);
      const pf: PlacedFixture = {
        id: generateId(),
        fixtureDefId: def.id,
        xMm: x,
        yMm: y,
        rotationDeg: 0,
      };
      setPlaced((prev) => [...prev, pf]);
      setSelectedId(pf.id);
    };

    const select = (id: string | null) => setSelectedId(id);

    const move = (id: string, xMm: number, yMm: number) => {
      setPlaced((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, xMm: snapMmToGrid(xMm, gridSizeMm), yMm: snapMmToGrid(yMm, gridSizeMm) }
            : p,
        ),
      );
    };

    const rotateSelected = () => {
      if (!selectedId) return;
      setPlaced((prev) =>
        prev.map((p) =>
          p.id === selectedId ? { ...p, rotationDeg: (p.rotationDeg + 90) % 360 } : p,
        ),
      );
    };

    const copySelected = () => {
      if (!selectedId) return;
      const copyId = generateId();
      // 함수형 업데이트로 최신 상태에서 원본을 찾는다(연속 액션 시 stale 방지).
      setPlaced((prev) => {
        const src = prev.find((p) => p.id === selectedId);
        if (!src) return prev;
        return [
          ...prev,
          { ...src, id: copyId, xMm: src.xMm + gridSizeMm, yMm: src.yMm + gridSizeMm },
        ];
      });
      setSelectedId(copyId);
    };

    const deleteSelected = () => {
      if (!selectedId) return;
      setPlaced((prev) => prev.filter((p) => p.id !== selectedId));
      setSelectedId(null);
    };

    const updateSelected = (patch: Partial<PlacedFixture>) => {
      if (!selectedId) return;
      setPlaced((prev) =>
        prev.map((p) => (p.id === selectedId ? { ...p, ...patch } : p)),
      );
    };

    const nudgeSelected = (dxMm: number, dyMm: number) => {
      if (!selectedId) return;
      setPlaced((prev) =>
        prev.map((p) =>
          p.id === selectedId ? { ...p, xMm: p.xMm + dxMm, yMm: p.yMm + dyMm } : p,
        ),
      );
    };

    const setSelectedPosition = (xMm: number, yMm: number) =>
      updateSelected({ xMm, yMm });

    const setSelectedRotation = (deg: number) =>
      updateSelected({ rotationDeg: ((deg % 360) + 360) % 360 });

    // --- 배치안(Layout) 저장/불러오기 ---
    const currentLayout =
      layouts.find((l) => l.id === currentLayoutId) ?? null;

    // 저장 필요 여부: 현재 배치가 저장된 배치안과 다른가
    const dirty = currentLayout
      ? JSON.stringify(placed) !== JSON.stringify(currentLayout.placedFixtures)
      : placed.length > 0;

    const suggestLayoutName = () => `v${layouts.length + 1}`;

    const persistLayout = async (layout: Layout) => {
      if (!projectId) return;
      await storage.saveLayout(projectId, layout);
      setLayouts(await storage.getLayouts(projectId));
      setCurrentLayoutId(layout.id);
    };

    const saveCurrent = async () => {
      const now = Date.now();
      if (currentLayout) {
        await persistLayout({
          ...currentLayout,
          placedFixtures: clonePlaced(placed),
          updatedAt: now,
        });
      } else {
        // 배치안이 없으면 기본 v1 자동 생성
        await persistLayout({
          id: generateId(),
          name: suggestLayoutName(),
          placedFixtures: clonePlaced(placed),
          createdAt: now,
          updatedAt: now,
        });
      }
    };

    const saveAs = async (name: string) => {
      const now = Date.now();
      await persistLayout({
        id: generateId(),
        name: name.trim() || suggestLayoutName(),
        placedFixtures: clonePlaced(placed),
        createdAt: now,
        updatedAt: now,
      });
    };

    const loadLayout = (layoutId: string) => {
      const layout = layouts.find((l) => l.id === layoutId);
      if (!layout) return;
      setPlaced(clonePlaced(layout.placedFixtures));
      setCurrentLayoutId(layout.id);
      setSelectedId(null);
    };

    return {
      project,
      projectLoading,
      fixtures,
      fixturesLoading,
      fixturesById,
      saveFixture,
      deleteFixture,
      placed,
      selectedId,
      gridSizeMm,
      place,
      select,
      move,
      rotateSelected,
      copySelected,
      deleteSelected,
      nudgeSelected,
      setSelectedPosition,
      setSelectedRotation,
      layouts,
      currentLayoutId,
      dirty,
      saveCurrent,
      saveAs,
      loadLayout,
      suggestLayoutName,
    };
  }, [
    project,
    projectLoading,
    fixtures,
    fixturesLoading,
    fixturesById,
    saveFixture,
    deleteFixture,
    placed,
    selectedId,
    gridSizeMm,
    layouts,
    currentLayoutId,
    projectId,
  ]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

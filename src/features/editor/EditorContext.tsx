import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import type {
  FixtureDef,
  Layout,
  PlacedDimension,
  PlacedFixture,
  PlacedImage,
  PlacedText,
  Project,
  WallItems,
  WallSide,
} from '../../types';
import { storage } from '../../storage';
import { generateId } from '../../utils/id';
import { useFixtures } from '../fixtures/useFixtures';
import { snapMmToGrid } from '../canvas/coords';
import { DEFAULT_GRID_SIZE_MM } from '../canvas/constants';
import {
  DEFAULT_TEXT_CONTENT,
  DEFAULT_TEXT_FONT_MM,
  DEFAULT_TEXT_COLOR,
} from '../texts/constants';
import {
  DEFAULT_DIMENSION_LENGTH_MM,
  DEFAULT_DIMENSION_COLOR,
  DEFAULT_DIMENSION_TEXT_COLOR,
  DEFAULT_DIMENSION_LINE_WIDTH_PX,
} from '../dimensions/constants';
import {
  emptyWallItems,
  normalizeWallItems,
  WALL_SIDES,
  getWallLengthMm,
  type ViewMode,
} from '../wall/constants';

type ItemType = 'fixture' | 'text' | 'dimension' | 'image';

/**
 * 통합 선택 상태.
 *  - plan 스코프: 평면도의 집기/텍스트/치수선/이미지
 *  - wall 스코프: 특정 벽면의 텍스트/치수선/이미지
 */
export type SelectedItem =
  | { scope: 'plan'; type: ItemType; id: string }
  | { scope: 'wall'; wall: WallSide; type: 'text' | 'dimension' | 'image'; id: string }
  | null;

/** 이미지 추가 시 필요한 최소 정보 (파일 로드 후 툴바에서 계산) */
export interface NewImageInput {
  name: string;
  srcDataUrl: string;
  widthMm: number;
  heightMm: number;
}

interface EditorContextValue {
  project: Project | null;
  projectLoading: boolean;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // 배치안(Layout)
  layouts: Layout[];
  currentLayoutId: string | null;
  dirty: boolean;
  saveCurrent: () => Promise<void>;
  saveAs: (name: string) => Promise<void>;
  loadLayout: (layoutId: string) => void;
  suggestLayoutName: () => string;

  // 집기 라이브러리
  fixtures: FixtureDef[];
  fixturesLoading: boolean;
  fixturesById: Map<string, FixtureDef>;
  saveFixture: (f: FixtureDef) => Promise<void>;
  deleteFixture: (id: string) => Promise<void>;

  // 평면도 배치
  placed: PlacedFixture[];
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  planImages: PlacedImage[];
  // 벽면 배치
  wallItems: WallItems;
  gridSizeMm: number;

  // 선택
  selectedItem: SelectedItem;
  selectedFixtureId: string | null; // plan 스코프
  selectedTextId: string | null; // plan 스코프
  selectedDimensionId: string | null; // plan 스코프
  selectedImageId: string | null; // plan 스코프
  /** 선택된 텍스트/치수선/이미지 객체 (plan/wall 공통) — 패널용 */
  selectedText: PlacedText | null;
  selectedDimension: PlacedDimension | null;
  selectedImage: PlacedImage | null;

  // 집기 액션 (plan 전용)
  place: (def: FixtureDef) => void;
  select: (id: string | null) => void;
  move: (id: string, xMm: number, yMm: number, snapToGrid?: boolean) => void;
  setSelectedPosition: (xMm: number, yMm: number) => void;
  setSelectedRotation: (deg: number) => void;

  // 텍스트/치수선 추가 (현재 viewMode 에 따라 plan 또는 벽면에)
  addText: () => void;
  addDimension: () => void;

  // plan 텍스트/치수선 선택·이동 (BoothCanvas)
  selectText: (id: string | null) => void;
  moveText: (id: string, xMm: number, yMm: number, snapToGrid?: boolean) => void;
  selectDimension: (id: string | null) => void;
  moveDimension: (id: string, dxMm: number, dyMm: number) => void;

  // 벽면 텍스트/치수선 선택·이동 (WallCanvas)
  selectWallText: (wall: WallSide, id: string | null) => void;
  moveWallText: (wall: WallSide, id: string, xMm: number, yMm: number, snapToGrid?: boolean) => void;
  selectWallDimension: (wall: WallSide, id: string | null) => void;
  moveWallDimension: (wall: WallSide, id: string, dxMm: number, dyMm: number) => void;
  clearSelection: () => void;

  // 이미지
  addImage: (input: NewImageInput) => void;
  selectImage: (id: string | null) => void;
  updatePlanImage: (id: string, patch: Partial<PlacedImage>) => void;
  selectWallImage: (wall: WallSide, id: string | null) => void;
  updateWallImage: (wall: WallSide, id: string, patch: Partial<PlacedImage>) => void;

  // 선택 속성 수정 (패널)
  updateSelectedText: (patch: Partial<PlacedText>) => void;
  updateSelectedDimension: (patch: Partial<PlacedDimension>) => void;
  updateSelectedImage: (patch: Partial<PlacedImage>) => void;

  // 선택 대상 공통(분기)
  rotateSelected: () => void;
  copySelected: () => void;
  deleteSelected: () => void;
  nudgeSelected: (dxMm: number, dyMm: number) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used within <EditorProvider>');
  return ctx;
}

// --- clone helpers ---
const clonePlaced = (l: PlacedFixture[]) => l.map((p) => ({ ...p }));
const cloneTexts = (l: PlacedText[]) => l.map((t) => ({ ...t }));
const cloneDims = (l: PlacedDimension[]) => l.map((d) => ({ ...d }));
const cloneImages = (l: PlacedImage[]) => l.map((i) => ({ ...i }));
function cloneWallItems(w: WallItems): WallItems {
  const out = emptyWallItems();
  for (const side of WALL_SIDES) {
    out[side] = {
      texts: cloneTexts(w[side].texts),
      dimensions: cloneDims(w[side].dimensions),
      images: cloneImages(w[side].images),
    };
  }
  return out;
}

// 치수선 중심 기준 회전
function rotateDimensionBy(d: PlacedDimension, deg: number): PlacedDimension {
  const rad = (deg * Math.PI) / 180;
  const cx = (d.startXMm + d.endXMm) / 2;
  const cy = (d.startYMm + d.endYMm) / 2;
  const rot = (x: number, y: number) => ({
    x: cx + (x - cx) * Math.cos(rad) - (y - cy) * Math.sin(rad),
    y: cy + (x - cx) * Math.sin(rad) + (y - cy) * Math.cos(rad),
  });
  const s = rot(d.startXMm, d.startYMm);
  const e = rot(d.endXMm, d.endYMm);
  return { ...d, startXMm: s.x, startYMm: s.y, endXMm: e.x, endYMm: e.y };
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const { projectId } = useParams();

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  const { fixtures, loading: fixturesLoading, saveFixture, deleteFixture } = useFixtures();

  const [placed, setPlaced] = useState<PlacedFixture[]>([]);
  const [texts, setTexts] = useState<PlacedText[]>([]);
  const [dimensions, setDimensions] = useState<PlacedDimension[]>([]);
  const [planImages, setPlanImages] = useState<PlacedImage[]>([]);
  const [wallItems, setWallItems] = useState<WallItems>(emptyWallItems());
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [gridSizeMm] = useState(DEFAULT_GRID_SIZE_MM);
  const [viewMode, setViewMode] = useState<ViewMode>('plan');

  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null);

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
      setTexts(latest?.texts ? cloneTexts(latest.texts) : []);
      setDimensions(latest?.dimensions ? cloneDims(latest.dimensions) : []);
      setPlanImages(latest?.planImages ? cloneImages(latest.planImages) : []);
      setWallItems(cloneWallItems(normalizeWallItems(latest?.wallItems)));
      setCurrentLayoutId(latest?.id ?? null);
      setSelectedItem(null);
      setProjectLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  const fixturesById = useMemo(() => new Map(fixtures.map((f) => [f.id, f])), [fixtures]);

  const selectedFixtureId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'fixture' ? selectedItem.id : null;
  const selectedTextId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'text' ? selectedItem.id : null;
  const selectedDimensionId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'dimension' ? selectedItem.id : null;
  const selectedImageId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'image' ? selectedItem.id : null;

  // 선택된 텍스트/치수선/이미지 객체 (scope 무관)
  const selectedText: PlacedText | null = (() => {
    const it = selectedItem;
    if (!it || it.type !== 'text') return null;
    const arr = it.scope === 'plan' ? texts : wallItems[it.wall].texts;
    return arr.find((t) => t.id === it.id) ?? null;
  })();
  const selectedDimension: PlacedDimension | null = (() => {
    const it = selectedItem;
    if (!it || it.type !== 'dimension') return null;
    const arr = it.scope === 'plan' ? dimensions : wallItems[it.wall].dimensions;
    return arr.find((d) => d.id === it.id) ?? null;
  })();
  const selectedImage: PlacedImage | null = (() => {
    const it = selectedItem;
    if (!it || it.type !== 'image') return null;
    const arr = it.scope === 'plan' ? planImages : wallItems[it.wall].images;
    return arr.find((i) => i.id === it.id) ?? null;
  })();

  const value = useMemo<EditorContextValue>(() => {
    const boothW = project?.boothConfig.widthMm ?? 0;
    const boothD = project?.boothConfig.depthMm ?? 0;
    const boothH = project?.boothConfig.heightMm ?? 0;

    const updateWall = (wall: WallSide, updater: (g: WallItems[WallSide]) => WallItems[WallSide]) =>
      setWallItems((prev) => ({ ...prev, [wall]: updater(prev[wall]) }));

    // ---------- 집기 (plan) ----------
    const place = (def: FixtureDef) => {
      const x = snapMmToGrid(boothW / 2 - def.widthMm / 2, gridSizeMm);
      const y = snapMmToGrid(boothD / 2 - def.depthMm / 2, gridSizeMm);
      const id = generateId();
      setPlaced((prev) => [...prev, { id, fixtureDefId: def.id, xMm: x, yMm: y, rotationDeg: 0 }]);
      setSelectedItem({ scope: 'plan', type: 'fixture', id });
    };
    const select = (id: string | null) =>
      setSelectedItem(id ? { scope: 'plan', type: 'fixture', id } : null);
    const move = (id: string, xMm: number, yMm: number, snapToGrid = true) => {
      const nx = snapToGrid ? snapMmToGrid(xMm, gridSizeMm) : xMm;
      const ny = snapToGrid ? snapMmToGrid(yMm, gridSizeMm) : yMm;
      setPlaced((prev) => prev.map((p) => (p.id === id ? { ...p, xMm: nx, yMm: ny } : p)));
    };
    const setSelectedPosition = (xMm: number, yMm: number) => {
      if (selectedFixtureId) setPlaced((prev) => prev.map((p) => (p.id === selectedFixtureId ? { ...p, xMm, yMm } : p)));
    };
    const setSelectedRotation = (deg: number) => {
      if (selectedFixtureId) setPlaced((prev) => prev.map((p) => (p.id === selectedFixtureId ? { ...p, rotationDeg: ((deg % 360) + 360) % 360 } : p)));
    };

    // ---------- 텍스트/치수선 팩토리 ----------
    const makeText = (xMm: number, yMm: number): PlacedText => ({
      id: generateId(),
      text: DEFAULT_TEXT_CONTENT,
      xMm,
      yMm,
      rotationDeg: 0,
      fontSizeMm: DEFAULT_TEXT_FONT_MM,
      color: DEFAULT_TEXT_COLOR,
      bold: false,
      align: 'left',
    });
    const makeDimension = (cx: number, cy: number): PlacedDimension => {
      const half = DEFAULT_DIMENSION_LENGTH_MM / 2;
      return {
        id: generateId(),
        startXMm: cx - half,
        startYMm: cy,
        endXMm: cx + half,
        endYMm: cy,
        label: '',
        color: DEFAULT_DIMENSION_COLOR,
        textColor: DEFAULT_DIMENSION_TEXT_COLOR,
        lineWidthPx: DEFAULT_DIMENSION_LINE_WIDTH_PX,
        showArrows: true,
      };
    };

    // ---------- 추가 (viewMode 따라 plan 또는 벽면) ----------
    const addText = () => {
      if (viewMode === 'plan') {
        const t = makeText(snapMmToGrid(boothW / 2, gridSizeMm), snapMmToGrid(boothD / 2, gridSizeMm));
        setTexts((prev) => [...prev, t]);
        setSelectedItem({ scope: 'plan', type: 'text', id: t.id });
      } else {
        const wall = viewMode;
        const wlen = project ? getWallLengthMm(project.boothConfig, wall) : 0;
        const t = makeText(snapMmToGrid(wlen / 2, gridSizeMm), snapMmToGrid(boothH / 2, gridSizeMm));
        updateWall(wall, (g) => ({ ...g, texts: [...g.texts, t] }));
        setSelectedItem({ scope: 'wall', wall, type: 'text', id: t.id });
      }
    };
    const addDimension = () => {
      if (viewMode === 'plan') {
        const d = makeDimension(boothW / 2, boothD / 2);
        setDimensions((prev) => [...prev, d]);
        setSelectedItem({ scope: 'plan', type: 'dimension', id: d.id });
      } else {
        const wall = viewMode;
        const wlen = project ? getWallLengthMm(project.boothConfig, wall) : 0;
        const d = makeDimension(wlen / 2, boothH / 2);
        updateWall(wall, (g) => ({ ...g, dimensions: [...g.dimensions, d] }));
        setSelectedItem({ scope: 'wall', wall, type: 'dimension', id: d.id });
      }
    };

    // ---------- plan 텍스트/치수선 선택·이동 ----------
    const selectText = (id: string | null) => setSelectedItem(id ? { scope: 'plan', type: 'text', id } : null);
    const moveText = (id: string, xMm: number, yMm: number, snapToGrid = true) => {
      const nx = snapToGrid ? snapMmToGrid(xMm, gridSizeMm) : xMm;
      const ny = snapToGrid ? snapMmToGrid(yMm, gridSizeMm) : yMm;
      setTexts((prev) => prev.map((t) => (t.id === id ? { ...t, xMm: nx, yMm: ny } : t)));
    };
    const selectDimension = (id: string | null) => setSelectedItem(id ? { scope: 'plan', type: 'dimension', id } : null);
    const moveDimension = (id: string, dxMm: number, dyMm: number) =>
      setDimensions((prev) => prev.map((d) => (d.id === id ? { ...d, startXMm: d.startXMm + dxMm, startYMm: d.startYMm + dyMm, endXMm: d.endXMm + dxMm, endYMm: d.endYMm + dyMm } : d)));

    // ---------- 벽면 텍스트/치수선 선택·이동 ----------
    const selectWallText = (wall: WallSide, id: string | null) =>
      setSelectedItem(id ? { scope: 'wall', wall, type: 'text', id } : null);
    const moveWallText = (wall: WallSide, id: string, xMm: number, yMm: number, snapToGrid = true) => {
      const nx = snapToGrid ? snapMmToGrid(xMm, gridSizeMm) : xMm;
      const ny = snapToGrid ? snapMmToGrid(yMm, gridSizeMm) : yMm;
      updateWall(wall, (g) => ({ ...g, texts: g.texts.map((t) => (t.id === id ? { ...t, xMm: nx, yMm: ny } : t)) }));
    };
    const selectWallDimension = (wall: WallSide, id: string | null) =>
      setSelectedItem(id ? { scope: 'wall', wall, type: 'dimension', id } : null);
    const moveWallDimension = (wall: WallSide, id: string, dxMm: number, dyMm: number) =>
      updateWall(wall, (g) => ({ ...g, dimensions: g.dimensions.map((d) => (d.id === id ? { ...d, startXMm: d.startXMm + dxMm, startYMm: d.startYMm + dyMm, endXMm: d.endXMm + dxMm, endYMm: d.endYMm + dyMm } : d)) }));

    const clearSelection = () => setSelectedItem(null);

    // ---------- 이미지 ----------
    const makeImage = (input: NewImageInput, cx: number, cy: number): PlacedImage => ({
      id: generateId(),
      name: input.name,
      srcDataUrl: input.srcDataUrl,
      xMm: Math.round(cx - input.widthMm / 2),
      yMm: Math.round(cy - input.heightMm / 2),
      widthMm: input.widthMm,
      heightMm: input.heightMm,
      rotationDeg: 0,
      opacity: 1,
    });
    const addImage = (input: NewImageInput) => {
      if (viewMode === 'plan') {
        const img = makeImage(input, boothW / 2, boothD / 2);
        setPlanImages((prev) => [...prev, img]);
        setSelectedItem({ scope: 'plan', type: 'image', id: img.id });
      } else {
        const wall = viewMode;
        const wlen = project ? getWallLengthMm(project.boothConfig, wall) : 0;
        const img = makeImage(input, wlen / 2, boothH / 2);
        updateWall(wall, (g) => ({ ...g, images: [...g.images, img] }));
        setSelectedItem({ scope: 'wall', wall, type: 'image', id: img.id });
      }
    };
    const selectImage = (id: string | null) => setSelectedItem(id ? { scope: 'plan', type: 'image', id } : null);
    const updatePlanImage = (id: string, patch: Partial<PlacedImage>) =>
      setPlanImages((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const selectWallImage = (wall: WallSide, id: string | null) =>
      setSelectedItem(id ? { scope: 'wall', wall, type: 'image', id } : null);
    const updateWallImage = (wall: WallSide, id: string, patch: Partial<PlacedImage>) =>
      updateWall(wall, (g) => ({ ...g, images: g.images.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

    // ---------- 선택 텍스트/치수선 수정 (scope 분기) ----------
    const mutateSelText = (fn: (t: PlacedText) => PlacedText) => {
      const it = selectedItem;
      if (!it || it.type !== 'text') return;
      if (it.scope === 'plan') setTexts((prev) => prev.map((t) => (t.id === it.id ? fn(t) : t)));
      else updateWall(it.wall, (g) => ({ ...g, texts: g.texts.map((t) => (t.id === it.id ? fn(t) : t)) }));
    };
    const mutateSelDim = (fn: (d: PlacedDimension) => PlacedDimension) => {
      const it = selectedItem;
      if (!it || it.type !== 'dimension') return;
      if (it.scope === 'plan') setDimensions((prev) => prev.map((d) => (d.id === it.id ? fn(d) : d)));
      else updateWall(it.wall, (g) => ({ ...g, dimensions: g.dimensions.map((d) => (d.id === it.id ? fn(d) : d)) }));
    };
    const mutateSelImage = (fn: (i: PlacedImage) => PlacedImage) => {
      const it = selectedItem;
      if (!it || it.type !== 'image') return;
      if (it.scope === 'plan') setPlanImages((prev) => prev.map((i) => (i.id === it.id ? fn(i) : i)));
      else updateWall(it.wall, (g) => ({ ...g, images: g.images.map((i) => (i.id === it.id ? fn(i) : i)) }));
    };
    const updateSelectedText = (patch: Partial<PlacedText>) => mutateSelText((t) => ({ ...t, ...patch }));
    const updateSelectedDimension = (patch: Partial<PlacedDimension>) => mutateSelDim((d) => ({ ...d, ...patch }));
    const updateSelectedImage = (patch: Partial<PlacedImage>) => mutateSelImage((i) => ({ ...i, ...patch }));

    // ---------- 선택 대상 공통 (타입·스코프 분기) ----------
    const rotateSelected = () => {
      const it = selectedItem;
      if (!it) return;
      if (it.type === 'fixture') setPlaced((prev) => prev.map((p) => (p.id === it.id ? { ...p, rotationDeg: (p.rotationDeg + 90) % 360 } : p)));
      else if (it.type === 'text') mutateSelText((t) => ({ ...t, rotationDeg: (t.rotationDeg + 90) % 360 }));
      else if (it.type === 'dimension') mutateSelDim((d) => rotateDimensionBy(d, 90));
      else if (it.type === 'image') mutateSelImage((i) => ({ ...i, rotationDeg: (i.rotationDeg + 90) % 360 }));
    };

    const copySelected = () => {
      const it = selectedItem;
      if (!it) return;
      const newId = generateId();
      if (it.type === 'fixture') {
        setPlaced((prev) => {
          const src = prev.find((p) => p.id === it.id);
          if (!src) return prev;
          return [...prev, { ...src, id: newId, xMm: src.xMm + gridSizeMm, yMm: src.yMm + gridSizeMm }];
        });
        setSelectedItem({ scope: 'plan', type: 'fixture', id: newId });
      } else if (it.type === 'text') {
        const dup = (arr: PlacedText[]) => {
          const src = arr.find((t) => t.id === it.id);
          return src ? [...arr, { ...src, id: newId, xMm: src.xMm + gridSizeMm, yMm: src.yMm + gridSizeMm }] : arr;
        };
        if (it.scope === 'plan') { setTexts(dup); setSelectedItem({ scope: 'plan', type: 'text', id: newId }); }
        else { updateWall(it.wall, (g) => ({ ...g, texts: dup(g.texts) })); setSelectedItem({ scope: 'wall', wall: it.wall, type: 'text', id: newId }); }
      } else if (it.type === 'dimension') {
        const dup = (arr: PlacedDimension[]) => {
          const src = arr.find((d) => d.id === it.id);
          return src ? [...arr, { ...src, id: newId, startXMm: src.startXMm + gridSizeMm, startYMm: src.startYMm + gridSizeMm, endXMm: src.endXMm + gridSizeMm, endYMm: src.endYMm + gridSizeMm }] : arr;
        };
        if (it.scope === 'plan') { setDimensions(dup); setSelectedItem({ scope: 'plan', type: 'dimension', id: newId }); }
        else { updateWall(it.wall, (g) => ({ ...g, dimensions: dup(g.dimensions) })); setSelectedItem({ scope: 'wall', wall: it.wall, type: 'dimension', id: newId }); }
      } else if (it.type === 'image') {
        const dup = (arr: PlacedImage[]) => {
          const src = arr.find((i) => i.id === it.id);
          return src ? [...arr, { ...src, id: newId, xMm: src.xMm + gridSizeMm, yMm: src.yMm + gridSizeMm }] : arr;
        };
        if (it.scope === 'plan') { setPlanImages(dup); setSelectedItem({ scope: 'plan', type: 'image', id: newId }); }
        else { updateWall(it.wall, (g) => ({ ...g, images: dup(g.images) })); setSelectedItem({ scope: 'wall', wall: it.wall, type: 'image', id: newId }); }
      }
    };

    const deleteSelected = () => {
      const it = selectedItem;
      if (!it) return;
      if (it.type === 'fixture') setPlaced((prev) => prev.filter((p) => p.id !== it.id));
      else if (it.type === 'text') {
        if (it.scope === 'plan') setTexts((prev) => prev.filter((t) => t.id !== it.id));
        else updateWall(it.wall, (g) => ({ ...g, texts: g.texts.filter((t) => t.id !== it.id) }));
      } else if (it.type === 'dimension') {
        if (it.scope === 'plan') setDimensions((prev) => prev.filter((d) => d.id !== it.id));
        else updateWall(it.wall, (g) => ({ ...g, dimensions: g.dimensions.filter((d) => d.id !== it.id) }));
      } else if (it.type === 'image') {
        if (it.scope === 'plan') setPlanImages((prev) => prev.filter((i) => i.id !== it.id));
        else updateWall(it.wall, (g) => ({ ...g, images: g.images.filter((i) => i.id !== it.id) }));
      }
      setSelectedItem(null);
    };

    const nudgeSelected = (dxMm: number, dyMm: number) => {
      const it = selectedItem;
      if (!it) return;
      if (it.type === 'fixture') setPlaced((prev) => prev.map((p) => (p.id === it.id ? { ...p, xMm: p.xMm + dxMm, yMm: p.yMm + dyMm } : p)));
      else if (it.type === 'text') mutateSelText((t) => ({ ...t, xMm: t.xMm + dxMm, yMm: t.yMm + dyMm }));
      else if (it.type === 'dimension') mutateSelDim((d) => ({ ...d, startXMm: d.startXMm + dxMm, startYMm: d.startYMm + dyMm, endXMm: d.endXMm + dxMm, endYMm: d.endYMm + dyMm }));
      else if (it.type === 'image') mutateSelImage((i) => ({ ...i, xMm: i.xMm + dxMm, yMm: i.yMm + dyMm }));
    };

    // ---------- 배치안 저장/불러오기 ----------
    const currentLayout = layouts.find((l) => l.id === currentLayoutId) ?? null;

    const dirty = currentLayout
      ? JSON.stringify(placed) !== JSON.stringify(currentLayout.placedFixtures) ||
        JSON.stringify(texts) !== JSON.stringify(currentLayout.texts ?? []) ||
        JSON.stringify(dimensions) !== JSON.stringify(currentLayout.dimensions ?? []) ||
        JSON.stringify(planImages) !== JSON.stringify(currentLayout.planImages ?? []) ||
        JSON.stringify(wallItems) !== JSON.stringify(normalizeWallItems(currentLayout.wallItems))
      : placed.length > 0 || texts.length > 0 || dimensions.length > 0 || planImages.length > 0 ||
        WALL_SIDES.some((s) => wallItems[s].texts.length > 0 || wallItems[s].dimensions.length > 0 || wallItems[s].images.length > 0);

    const suggestLayoutName = () => `v${layouts.length + 1}`;

    const persistLayout = async (layout: Layout) => {
      if (!projectId) return;
      await storage.saveLayout(projectId, layout);
      setLayouts(await storage.getLayouts(projectId));
      setCurrentLayoutId(layout.id);
    };

    const snapshot = () => ({
      placedFixtures: clonePlaced(placed),
      texts: cloneTexts(texts),
      dimensions: cloneDims(dimensions),
      planImages: cloneImages(planImages),
      wallItems: cloneWallItems(wallItems),
    });

    const saveCurrent = async () => {
      const now = Date.now();
      if (currentLayout) {
        await persistLayout({ ...currentLayout, ...snapshot(), updatedAt: now });
      } else {
        await persistLayout({ id: generateId(), name: suggestLayoutName(), ...snapshot(), createdAt: now, updatedAt: now });
      }
    };
    const saveAs = async (name: string) => {
      const now = Date.now();
      await persistLayout({ id: generateId(), name: name.trim() || suggestLayoutName(), ...snapshot(), createdAt: now, updatedAt: now });
    };
    const loadLayout = (layoutId: string) => {
      const layout = layouts.find((l) => l.id === layoutId);
      if (!layout) return;
      setPlaced(clonePlaced(layout.placedFixtures));
      setTexts(cloneTexts(layout.texts ?? []));
      setDimensions(cloneDims(layout.dimensions ?? []));
      setPlanImages(cloneImages(layout.planImages ?? []));
      setWallItems(cloneWallItems(normalizeWallItems(layout.wallItems)));
      setCurrentLayoutId(layout.id);
      setSelectedItem(null);
    };

    return {
      project,
      projectLoading,
      viewMode,
      setViewMode,
      layouts,
      currentLayoutId,
      dirty,
      saveCurrent,
      saveAs,
      loadLayout,
      suggestLayoutName,
      fixtures,
      fixturesLoading,
      fixturesById,
      saveFixture,
      deleteFixture,
      placed,
      texts,
      dimensions,
      planImages,
      wallItems,
      gridSizeMm,
      selectedItem,
      selectedFixtureId,
      selectedTextId,
      selectedDimensionId,
      selectedImageId,
      selectedText,
      selectedDimension,
      selectedImage,
      place,
      select,
      move,
      setSelectedPosition,
      setSelectedRotation,
      addText,
      addDimension,
      selectText,
      moveText,
      selectDimension,
      moveDimension,
      selectWallText,
      moveWallText,
      selectWallDimension,
      moveWallDimension,
      clearSelection,
      addImage,
      selectImage,
      updatePlanImage,
      selectWallImage,
      updateWallImage,
      updateSelectedText,
      updateSelectedDimension,
      updateSelectedImage,
      rotateSelected,
      copySelected,
      deleteSelected,
      nudgeSelected,
    };
  }, [
    project,
    projectLoading,
    viewMode,
    fixtures,
    fixturesLoading,
    fixturesById,
    saveFixture,
    deleteFixture,
    placed,
    texts,
    dimensions,
    planImages,
    wallItems,
    selectedItem,
    selectedFixtureId,
    selectedTextId,
    selectedDimensionId,
    selectedImageId,
    selectedText,
    selectedDimension,
    selectedImage,
    gridSizeMm,
    layouts,
    currentLayoutId,
    projectId,
  ]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

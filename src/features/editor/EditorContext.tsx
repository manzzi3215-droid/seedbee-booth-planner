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
  SvgDocument,
  WallItems,
  WallSide,
} from '../../types';
import { storage } from '../../storage';
import { generateId } from '../../utils/id';
import { useFixtures } from '../fixtures/useFixtures';
import { snapMmToGrid } from '../canvas/coords';
import { DEFAULT_GRID_SIZE_MM } from '../canvas/constants';
import { convertSvgElement } from '../svg/SvgConverter';
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
  | { scope: 'plan'; type: ItemType | 'background' | 'svg'; id: string }
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
  renameLayout: (id: string, name: string) => Promise<void>;
  duplicateLayout: (id: string) => Promise<void>;
  deleteLayoutById: (id: string) => Promise<void>;

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
  planBackgrounds: PlacedImage[];
  // 벽면 배치
  wallItems: WallItems;
  gridSizeMm: number;

  // 집기명 표시 토글 (저장 안 함)
  showFixtureNames: boolean;
  setShowFixtureNames: (v: boolean) => void;

  // 선택
  selectedItem: SelectedItem;
  selectedFixtureId: string | null; // plan 스코프
  selectedTextId: string | null; // plan 스코프
  selectedDimensionId: string | null; // plan 스코프
  selectedImageId: string | null; // plan 스코프
  selectedBackgroundId: string | null; // plan 스코프
  /** 선택된 텍스트/치수선/이미지 객체 (plan/wall 공통) — 패널용 */
  selectedText: PlacedText | null;
  selectedDimension: PlacedDimension | null;
  selectedImage: PlacedImage | null;
  selectedBackground: PlacedImage | null;

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

  // SVG 배경 (평면도 전용)
  addBackground: (input: NewImageInput) => void;
  selectBackground: (id: string | null) => void;
  updatePlanBackground: (id: string, patch: Partial<PlacedImage>) => void;

  // SVG 문서 (구조 파싱, 평면도 전용) — v0.7.0
  svgDocuments: SvgDocument[];
  selectedSvgId: string | null;
  selectedSvgDocument: SvgDocument | null;
  /** Inspector 에서 선택된 도형 id (저장 안 함, 하이라이트용) */
  selectedSvgElementId: string | null;
  setSelectedSvgElementId: (id: string | null) => void;
  addSvgDocument: (doc: SvgDocument) => void;
  selectSvgDocument: (id: string | null) => void;
  /** SVG 도형 → 집기/치수선 변환 (Canvas 에만 생성, 라이브러리 저장 안 함) */
  convertSvgElementToFixture: (docId: string, elementId: string) => void;

  // 선택 속성 수정 (패널)
  updateSelectedText: (patch: Partial<PlacedText>) => void;
  updateSelectedDimension: (patch: Partial<PlacedDimension>) => void;
  updateSelectedImage: (patch: Partial<PlacedImage>) => void;
  updateSelectedBackground: (patch: Partial<PlacedImage>) => void;

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
const cloneSvgDocs = (l: SvgDocument[]) =>
  l.map((d) => ({ ...d, elements: d.elements.map((e) => ({ ...e })) }));
const cloneFixtureDefs = (l: FixtureDef[]) => l.map((f) => ({ ...f }));
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
  const [planBackgrounds, setPlanBackgrounds] = useState<PlacedImage[]>([]);
  const [localFixtures, setLocalFixtures] = useState<FixtureDef[]>([]);
  const [svgDocuments, setSvgDocuments] = useState<SvgDocument[]>([]);
  const [wallItems, setWallItems] = useState<WallItems>(emptyWallItems());
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [selectedSvgElementId, setSelectedSvgElementId] = useState<string | null>(null);
  const [gridSizeMm] = useState(DEFAULT_GRID_SIZE_MM);
  const [viewMode, setViewMode] = useState<ViewMode>('plan');
  const [showFixtureNames, setShowFixtureNames] = useState(true);

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
      setPlanBackgrounds(latest?.planBackgrounds ? cloneImages(latest.planBackgrounds) : []);
      setLocalFixtures(latest?.localFixtures ? cloneFixtureDefs(latest.localFixtures) : []);
      setSvgDocuments(latest?.svgDocuments ? cloneSvgDocs(latest.svgDocuments) : []);
      setWallItems(cloneWallItems(normalizeWallItems(latest?.wallItems)));
      setCurrentLayoutId(latest?.id ?? null);
      setSelectedItem(null);
      setSelectedSvgElementId(null);
      setProjectLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  // 전역 라이브러리 + 배치안-로컬(SVG 변환) 집기 정의를 함께 조회
  const fixturesById = useMemo(
    () => new Map([...fixtures, ...localFixtures].map((f) => [f.id, f])),
    [fixtures, localFixtures],
  );

  const selectedFixtureId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'fixture' ? selectedItem.id : null;
  const selectedTextId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'text' ? selectedItem.id : null;
  const selectedDimensionId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'dimension' ? selectedItem.id : null;
  const selectedImageId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'image' ? selectedItem.id : null;
  const selectedBackgroundId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'background' ? selectedItem.id : null;
  const selectedSvgId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'svg' ? selectedItem.id : null;

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
  const selectedBackground: PlacedImage | null =
    selectedBackgroundId ? planBackgrounds.find((b) => b.id === selectedBackgroundId) ?? null : null;
  const selectedSvgDocument: SvgDocument | null =
    selectedSvgId ? svgDocuments.find((d) => d.id === selectedSvgId) ?? null : null;

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

    // ---------- SVG 배경 (평면도 전용) ----------
    const addBackground = (input: NewImageInput) => {
      const bg: PlacedImage = {
        id: generateId(),
        name: input.name,
        srcDataUrl: input.srcDataUrl,
        xMm: 0,
        yMm: 0,
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        rotationDeg: 0,
        opacity: 0.8,
        locked: false,
      };
      setPlanBackgrounds((prev) => [...prev, bg]);
      setSelectedItem({ scope: 'plan', type: 'background', id: bg.id });
    };
    const selectBackground = (id: string | null) => setSelectedItem(id ? { scope: 'plan', type: 'background', id } : null);
    const updatePlanBackground = (id: string, patch: Partial<PlacedImage>) =>
      setPlanBackgrounds((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

    // ---------- SVG 문서 (구조 파싱) ----------
    const addSvgDocument = (doc: SvgDocument) => {
      setSvgDocuments((prev) => [...prev, doc]);
      setSelectedSvgElementId(null);
      setSelectedItem({ scope: 'plan', type: 'svg', id: doc.id });
    };
    const selectSvgDocument = (id: string | null) => {
      setSelectedSvgElementId(null);
      setSelectedItem(id ? { scope: 'plan', type: 'svg', id } : null);
    };
    const markElementConverted = (docId: string, elId: string) =>
      setSvgDocuments((prev) =>
        prev.map((d) =>
          d.id !== docId
            ? d
            : {
                ...d,
                elements: d.elements.map((e) => (e.id === elId ? { ...e, converted: true } : e)),
                updatedAt: Date.now(),
              },
        ),
      );
    const convertSvgElementToFixture = (docId: string, elementId: string) => {
      const doc = svgDocuments.find((d) => d.id === docId);
      if (!doc) return;
      const el = doc.elements.find((e) => e.id === elementId);
      if (!el || el.converted) return;
      const out = convertSvgElement(doc, el);
      if (!out) return;
      if (out.kind === 'fixture') {
        setLocalFixtures((prev) => [...prev, out.def]);
        const pid = generateId();
        setPlaced((prev) => [...prev, { id: pid, fixtureDefId: out.def.id, xMm: out.xMm, yMm: out.yMm, rotationDeg: 0 }]);
        setSelectedItem({ scope: 'plan', type: 'fixture', id: pid });
      } else {
        const did = generateId();
        setDimensions((prev) => [
          ...prev,
          {
            id: did,
            startXMm: out.startXMm,
            startYMm: out.startYMm,
            endXMm: out.endXMm,
            endYMm: out.endYMm,
            label: '',
            color: out.color,
            textColor: DEFAULT_DIMENSION_TEXT_COLOR,
            lineWidthPx: DEFAULT_DIMENSION_LINE_WIDTH_PX,
            showArrows: true,
          },
        ]);
        setSelectedItem({ scope: 'plan', type: 'dimension', id: did });
      }
      markElementConverted(docId, elementId);
      setSelectedSvgElementId(null);
    };

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
    const mutateSelBackground = (fn: (i: PlacedImage) => PlacedImage) => {
      const it = selectedItem;
      if (!it || it.scope !== 'plan' || it.type !== 'background') return;
      setPlanBackgrounds((prev) => prev.map((b) => (b.id === it.id ? fn(b) : b)));
    };
    const updateSelectedText = (patch: Partial<PlacedText>) => mutateSelText((t) => ({ ...t, ...patch }));
    const updateSelectedDimension = (patch: Partial<PlacedDimension>) => mutateSelDim((d) => ({ ...d, ...patch }));
    const updateSelectedImage = (patch: Partial<PlacedImage>) => mutateSelImage((i) => ({ ...i, ...patch }));
    const updateSelectedBackground = (patch: Partial<PlacedImage>) => mutateSelBackground((b) => ({ ...b, ...patch }));

    // ---------- 선택 대상 공통 (타입·스코프 분기) ----------
    const rotateSelected = () => {
      const it = selectedItem;
      if (!it) return;
      if (it.type === 'fixture') setPlaced((prev) => prev.map((p) => (p.id === it.id ? { ...p, rotationDeg: (p.rotationDeg + 90) % 360 } : p)));
      else if (it.type === 'text') mutateSelText((t) => ({ ...t, rotationDeg: (t.rotationDeg + 90) % 360 }));
      else if (it.type === 'dimension') mutateSelDim((d) => rotateDimensionBy(d, 90));
      else if (it.type === 'image') mutateSelImage((i) => ({ ...i, rotationDeg: (i.rotationDeg + 90) % 360 }));
      else if (it.type === 'background') mutateSelBackground((b) => ({ ...b, rotationDeg: (b.rotationDeg + 90) % 360 }));
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
      } else if (it.type === 'background') {
        setPlanBackgrounds((prev) => {
          const src = prev.find((b) => b.id === it.id);
          return src ? [...prev, { ...src, id: newId, xMm: src.xMm + gridSizeMm, yMm: src.yMm + gridSizeMm, locked: false }] : prev;
        });
        setSelectedItem({ scope: 'plan', type: 'background', id: newId });
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
      } else if (it.type === 'background') {
        setPlanBackgrounds((prev) => prev.filter((b) => b.id !== it.id));
      } else if (it.type === 'svg') {
        setSvgDocuments((prev) => prev.filter((d) => d.id !== it.id));
        setSelectedSvgElementId(null);
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
      else if (it.type === 'background') mutateSelBackground((b) => ({ ...b, xMm: b.xMm + dxMm, yMm: b.yMm + dyMm }));
    };

    // ---------- 배치안 저장/불러오기 ----------
    const currentLayout = layouts.find((l) => l.id === currentLayoutId) ?? null;

    const dirty = currentLayout
      ? JSON.stringify(placed) !== JSON.stringify(currentLayout.placedFixtures) ||
        JSON.stringify(texts) !== JSON.stringify(currentLayout.texts ?? []) ||
        JSON.stringify(dimensions) !== JSON.stringify(currentLayout.dimensions ?? []) ||
        JSON.stringify(planImages) !== JSON.stringify(currentLayout.planImages ?? []) ||
        JSON.stringify(planBackgrounds) !== JSON.stringify(currentLayout.planBackgrounds ?? []) ||
        JSON.stringify(svgDocuments) !== JSON.stringify(currentLayout.svgDocuments ?? []) ||
        JSON.stringify(localFixtures) !== JSON.stringify(currentLayout.localFixtures ?? []) ||
        JSON.stringify(wallItems) !== JSON.stringify(normalizeWallItems(currentLayout.wallItems))
      : placed.length > 0 || texts.length > 0 || dimensions.length > 0 || planImages.length > 0 || planBackgrounds.length > 0 || svgDocuments.length > 0 ||
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
      planBackgrounds: cloneImages(planBackgrounds),
      localFixtures: cloneFixtureDefs(localFixtures),
      svgDocuments: cloneSvgDocs(svgDocuments),
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
    // 배치안 데이터를 편집기 상태에 적용 (null 이면 빈 캔버스)
    const applyLayout = (layout: Layout | null) => {
      setPlaced(layout ? clonePlaced(layout.placedFixtures) : []);
      setTexts(cloneTexts(layout?.texts ?? []));
      setDimensions(cloneDims(layout?.dimensions ?? []));
      setPlanImages(cloneImages(layout?.planImages ?? []));
      setPlanBackgrounds(cloneImages(layout?.planBackgrounds ?? []));
      setLocalFixtures(cloneFixtureDefs(layout?.localFixtures ?? []));
      setSvgDocuments(cloneSvgDocs(layout?.svgDocuments ?? []));
      setWallItems(cloneWallItems(normalizeWallItems(layout?.wallItems)));
      setCurrentLayoutId(layout?.id ?? null);
      setSelectedItem(null);
      setSelectedSvgElementId(null);
    };
    const loadLayout = (layoutId: string) => {
      const layout = layouts.find((l) => l.id === layoutId);
      if (layout) applyLayout(layout);
    };

    // 이름 변경
    const renameLayout = async (id: string, name: string) => {
      const target = layouts.find((l) => l.id === id);
      if (!target || !projectId) return;
      const updated: Layout = { ...target, name: name.trim() || target.name, updatedAt: Date.now() };
      await storage.saveLayout(projectId, updated);
      setLayouts(await storage.getLayouts(projectId));
    };

    // 복제 (현재 배치안이면 화면 그대로 스냅샷, 아니면 저장본 복제) → 새 배치안 자동 선택
    const duplicateLayout = async (id: string) => {
      if (!projectId) return;
      const src = layouts.find((l) => l.id === id);
      if (!src) return;
      const now = Date.now();
      const data =
        id === currentLayoutId
          ? snapshot()
          : {
              placedFixtures: clonePlaced(src.placedFixtures),
              texts: cloneTexts(src.texts ?? []),
              dimensions: cloneDims(src.dimensions ?? []),
              planImages: cloneImages(src.planImages ?? []),
              planBackgrounds: cloneImages(src.planBackgrounds ?? []),
              localFixtures: cloneFixtureDefs(src.localFixtures ?? []),
              svgDocuments: cloneSvgDocs(src.svgDocuments ?? []),
              wallItems: cloneWallItems(normalizeWallItems(src.wallItems)),
            };
      const copy: Layout = { id: generateId(), name: `${src.name} 복사본`, ...data, createdAt: now, updatedAt: now };
      await persistLayout(copy); // 저장 + 목록 갱신 + currentLayoutId=copy.id
      applyLayout(copy); // 편집기에 복제 데이터 반영(자동 선택)
    };

    // 삭제 → 삭제한 게 현재면 가장 최근 배치안 자동 선택 (없으면 빈 캔버스)
    const deleteLayoutById = async (id: string) => {
      if (!projectId) return;
      await storage.deleteLayout(projectId, id);
      const remaining = await storage.getLayouts(projectId);
      setLayouts(remaining);
      if (currentLayoutId === id) {
        const latest = remaining.length
          ? remaining.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))
          : null;
        applyLayout(latest);
      }
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
      renameLayout,
      duplicateLayout,
      deleteLayoutById,
      fixtures,
      fixturesLoading,
      fixturesById,
      saveFixture,
      deleteFixture,
      placed,
      texts,
      dimensions,
      planImages,
      planBackgrounds,
      wallItems,
      gridSizeMm,
      showFixtureNames,
      setShowFixtureNames,
      selectedItem,
      selectedFixtureId,
      selectedTextId,
      selectedDimensionId,
      selectedImageId,
      selectedBackgroundId,
      selectedText,
      selectedDimension,
      selectedImage,
      selectedBackground,
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
      addBackground,
      selectBackground,
      updatePlanBackground,
      svgDocuments,
      selectedSvgId,
      selectedSvgDocument,
      selectedSvgElementId,
      setSelectedSvgElementId,
      addSvgDocument,
      selectSvgDocument,
      convertSvgElementToFixture,
      updateSelectedText,
      updateSelectedDimension,
      updateSelectedImage,
      updateSelectedBackground,
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
    planBackgrounds,
    localFixtures,
    svgDocuments,
    wallItems,
    showFixtureNames,
    selectedItem,
    selectedSvgElementId,
    selectedFixtureId,
    selectedTextId,
    selectedDimensionId,
    selectedImageId,
    selectedBackgroundId,
    selectedSvgId,
    selectedSvgDocument,
    selectedText,
    selectedDimension,
    selectedImage,
    selectedBackground,
    gridSizeMm,
    layouts,
    currentLayoutId,
    projectId,
  ]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useParams } from 'react-router-dom';
import type {
  Asset,
  BoothConfig,
  BoothStyling,
  StylePresetId,
  DesignAsset,
  DesignMapping,
  FixtureDef,
  Layout,
  PlacedDimension,
  PlacedFixture,
  PlacedImage,
  PlacedProduct,
  PlacedText,
  PointMm,
  Product,
  ProductFacing,
  Project,
  SvgDocument,
  WallItems,
  WallSide,
} from '../../types';
import { gridArrange as gridArrangeProducts } from '../products/productModel';
import { getFixtureSurface, pickTargetFixture, clampToSurface } from '../products/displaySurface';
import type { ProductPreset, ProductPresetItem } from '../../types';
import { storage, isCloudStorage } from '../../storage';
import { generateId } from '../../utils/id';
import { useFixtures } from '../fixtures/useFixtures';
import { useAssets } from '../assets/useAssets';
import { fixtureDefFromAsset } from '../assets/assetModel';
import { DEFAULT_TEXTURE_TRANSFORM } from '../../types';
import { stylingFromPreset } from '../styling/styling';
import { snapMmToGrid } from '../canvas/coords';
import { DEFAULT_GRID_SIZE_MM } from '../canvas/constants';
import { computeFixtureAABB } from '../canvas/fixtureGeometry';
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

/** 저장 상태 (수동/자동 저장 표시용) */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** 자동 저장 debounce (ms) */
const AUTOSAVE_MS = 5000;

/**
 * 통합 선택 상태.
 *  - plan 스코프: 평면도의 집기/텍스트/치수선/이미지
 *  - wall 스코프: 특정 벽면의 텍스트/치수선/이미지
 */
export type SelectedItem =
  | { scope: 'plan'; type: ItemType | 'background' | 'svg' | 'product'; id: string }
  | { scope: 'wall'; wall: WallSide; type: 'text' | 'dimension' | 'image'; id: string }
  | null;

/** Undo/Redo 스냅샷 (배치안 편집 상태 전체 + 부스 외곽) — v0.9.0 */
interface HistorySnap {
  placed: PlacedFixture[];
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  planImages: PlacedImage[];
  planBackgrounds: PlacedImage[];
  localFixtures: FixtureDef[];
  designAssets: DesignAsset[];
  placedProducts: PlacedProduct[];
  svgDocuments: SvgDocument[];
  wallItems: WallItems;
  boothConfig: BoothConfig | null;
}

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

  /** 읽기 전용 모드(공유 링크 view 등) */
  readOnly: boolean;
  /** 평면도 보기 회전(deg, 보기 전용) */
  viewRotationDeg: number;
  setViewRotationDeg: (deg: number) => void;
  /**
   * 편집 가능 여부. 읽기전용만 아니면 true — 보기 회전 각도와 무관하게 편집 가능(v0.8.4).
   * (회전은 Stage 레이어의 view transform 이며, Konva 가 pointer→local 좌표를 자동 역변환)
   */
  canEdit: boolean;

  /** 사용할 벽면 ON/OFF 변경 (프로젝트에 저장) — v0.7.3 */
  setWallEnabled: (side: WallSide, enabled: boolean) => Promise<void>;

  // 부스 외곽 편집 (CAD 스타일) — v0.8.6
  shapeEditMode: boolean;
  setShapeEditMode: (v: boolean) => void;
  /** 부스 외곽 폴리곤(mm) 갱신 → boothShape=polygon + bbox 저장(디바운스 저장) */
  updateBoothShape: (points: PointMm[]) => void;
  /** 부스 스타일링(바닥/벽 재질·환경) 갱신 (v0.9.8) */
  updateBoothStyling: (patch: Partial<BoothStyling>) => void;
  /** 스타일 프리셋 원클릭 적용 (v0.9.8) */
  applyStylePreset: (id: StylePresetId) => void;

  // 배치안(Layout)
  layouts: Layout[];
  currentLayoutId: string | null;
  dirty: boolean;
  /** 저장 상태(수동/자동) */
  saveStatus: SaveStatus;
  /** Firestore(클라우드) 저장소 사용 중 여부 */
  isCloud: boolean;
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

  // ---------- Asset Library 2.0 (v0.9.7) ----------
  /** 전역 에셋 라이브러리 (My/Company) */
  assets: Asset[];
  assetsLoading: boolean;
  saveAsset: (a: Asset) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  toggleAssetFavorite: (id: string) => Promise<void>;
  /** 핀 고정 토글 (v0.9.8) */
  toggleAssetPin: (id: string) => Promise<void>;
  /** 최근 사용 에셋 id (최신순) */
  recentAssetIds: string[];
  /** 에셋을 부스에 배치 (집기+디자인 매핑 파이프라인 재사용 → 2D/3D 자동 반영) */
  placeAsset: (asset: Asset) => void;
  /** 배치된 집기를 에셋으로 등록 */
  createAssetFromFixture: (fixtureId: string, patch?: Partial<Asset>) => Asset | null;

  // SVG 변환 집기(배치안 로컬 정의) — v0.7.2
  localFixtures: FixtureDef[];
  updateLocalFixture: (defId: string, patch: Partial<FixtureDef>) => void;

  // 출력물 제작 (v0.8.9) — 집기 정의의 printSettings 갱신(로컬/전역 자동 판별 저장)
  updateFixturePrintSettings: (defId: string, printSettings: import('../../types').PrintSettings) => void;
  // 3D 재질 (v0.9.2)
  updateFixtureMaterial: (defId: string, material: import('../../types').FixtureMaterial) => void;

  // 디자인 매핑 (v0.8.7)
  designAssets: DesignAsset[];
  addDesignAsset: (asset: DesignAsset) => void;
  /** 집기 인스턴스의 디자인 매핑 설정(undefined 면 제거) */
  updateFixtureDesign: (fixtureId: string, design: DesignMapping | undefined) => void;
  /** 에셋 교체(같은 id 유지) → 사용 중인 모든 집기 자동 반영 */
  replaceDesignAsset: (assetId: string, patch: Partial<DesignAsset>) => void;
  /** 에셋 삭제 → 참조하는 매핑도 제거 */
  deleteDesignAsset: (assetId: string) => void;

  // ---------- Digital Merchandising (v0.9.3) ----------
  /** 제품 라이브러리(프로젝트 단위) */
  products: Product[];
  addProduct: (p: Product) => void;
  updateProduct: (id: string, patch: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  /** 배치된 제품 (집기 Display Surface 위) */
  placedProducts: PlacedProduct[];
  selectedProductId: string | null;
  selectProduct: (id: string | null) => void;
  placeProduct: (productId: string, hintFixtureId?: string) => void;
  moveProduct: (id: string, xMm: number, yMm: number, snap?: boolean) => void;
  updatePlacedProduct: (id: string, patch: Partial<PlacedProduct>) => void;
  deletePlacedProduct: (id: string) => void;
  duplicatePlacedProduct: (id: string) => void;
  replacePlacedProduct: (id: string, newProductId: string) => void;
  /** 한 번에 제품 교체(전체) */
  replaceProductEverywhere: (oldProductId: string, newProductId: string) => void;
  /** 선택 집기 위 제품 정렬/균등 배치 (§4, v1.0.0-pre) */
  arrangeProductsOnFixture: (fixtureId: string, mode: 'center' | 'distributeH' | 'distributeV' | 'front') => void;
  gridArrangeProduct: (
    productId: string,
    count: number,
    opts?: { spacingXMm?: number; spacingYMm?: number; cols?: number; scale?: number; facing?: ProductFacing; fixtureId?: string; pattern?: import('../products/productModel').ArrangePattern; radiusMm?: number },
  ) => void;

  // Merchandising Preset System (v0.9.4)
  productPresets: ProductPreset[];
  saveFixtureAsPreset: (fixtureId: string, name: string) => void;
  applyPresetToFixture: (fixtureId: string, presetId: string) => void;
  renamePreset: (id: string, name: string) => void;
  duplicatePreset: (id: string) => void;
  deletePreset: (id: string) => void;
  importPreset: (preset: ProductPreset) => void;

  // 평면도 배치
  placed: PlacedFixture[];
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  planImages: PlacedImage[];
  planBackgrounds: PlacedImage[];
  // 벽면 배치
  wallItems: WallItems;
  gridSizeMm: number;
  /** 그리드 크기 변경 (Settings, v0.9.5) */
  setGridSizeMm: (mm: number) => void;
  /** 그리드 스냅 on/off (Settings, v0.9.5) */
  snapEnabled: boolean;
  setSnapEnabled: (v: boolean) => void;

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
  select: (id: string | null, additive?: boolean) => void;
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
  addBackground: (input: NewImageInput, opts?: { xMm?: number; yMm?: number; opacity?: number; locked?: boolean }) => void;
  selectBackground: (id: string | null) => void;
  updatePlanBackground: (id: string, patch: Partial<PlacedImage>) => void;
  /** 도면(배경) 삭제 (v0.9.6) */
  deleteBackground: (id: string) => void;
  /** 도면 가져오기 마법사 (v0.9.6) */
  importWizardOpen: boolean;
  openImportWizard: () => void;
  closeImportWizard: () => void;

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

  // ---------- CAD 생산성 도구 (v0.9.0) ----------
  /** Undo/Redo */
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /** 다중 선택된 집기 id 목록 (plan 스코프) */
  selectedFixtureIds: string[];
  /** 집기 선택 (additive=true 면 다중 선택 토글) */
  selectFixture: (id: string | null, additive?: boolean) => void;
  /** 다중 선택 정렬 */
  alignFixtures: (mode: AlignMode) => void;
  /** 다중 선택 균등 분배 */
  distributeFixtures: (axis: 'h' | 'v') => void;
  /** 선택 미러 (copy=true 면 복제) */
  mirrorFixtures: (axis: 'h' | 'v', copy: boolean) => void;
  /** 배열 복사 (Linear/Circular) */
  arrayFixtures: (opts: ArrayOptions) => void;
  /** 다중 선택 복제 */
  duplicateFixtures: () => void;
  /** 다중 선택 삭제 */
  deleteFixtures: () => void;
}

/** 정렬 모드 */
export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV';

/** 배열 복사 옵션 */
export interface ArrayOptions {
  kind: 'linear' | 'circular';
  count: number;
  // linear
  spacingXMm?: number;
  spacingYMm?: number;
  // circular
  radiusMm?: number;
  totalAngleDeg?: number;
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
const cloneDesignAssets = (l: DesignAsset[]) => l.map((a) => ({ ...a }));
const cloneProducts = (l: Product[]) => l.map((p) => ({ ...p, images: p.images ? { ...p.images } : undefined, meta: p.meta ? { ...p.meta } : undefined }));
const clonePlacedProducts = (l: PlacedProduct[]) => l.map((p) => ({ ...p }));
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

/** 점 (x,y) 를 중심 (cx,cy) 기준 deg 만큼 회전 (v0.9.0 배열 복사) */
function rotatePointDeg(x: number, y: number, cx: number, cy: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = x - cx;
  const dy = y - cy;
  return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
}

/** 히스토리 스냅샷 동일성 — 불변 업데이트 전제, 참조 동일성으로 빠르게 비교 (v0.9.0) */
function sameHistorySnap(a: HistorySnap, b: HistorySnap): boolean {
  return (
    a.placed === b.placed &&
    a.texts === b.texts &&
    a.dimensions === b.dimensions &&
    a.planImages === b.planImages &&
    a.planBackgrounds === b.planBackgrounds &&
    a.localFixtures === b.localFixtures &&
    a.designAssets === b.designAssets &&
    a.placedProducts === b.placedProducts &&
    a.svgDocuments === b.svgDocuments &&
    a.wallItems === b.wallItems &&
    a.boothConfig === b.boothConfig
  );
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

export function EditorProvider({
  children,
  readOnly = false,
  projectIdOverride,
}: {
  children: ReactNode;
  /** 읽기 전용(공유 링크 view 권한 등): 저장/자동저장/편집 비활성 */
  readOnly?: boolean;
  /** 공유 링크 라우트 등에서 URL 파라미터 대신 프로젝트 id 지정 */
  projectIdOverride?: string;
}) {
  const params = useParams();
  const projectId = projectIdOverride ?? params.projectId;

  const [project, setProject] = useState<Project | null>(null);
  const [projectLoading, setProjectLoading] = useState(true);

  const { fixtures, loading: fixturesLoading, saveFixture, deleteFixture } = useFixtures();
  const {
    assets,
    loading: assetsLoading,
    saveAsset,
    deleteAsset,
    toggleFavorite: toggleAssetFavorite,
    togglePin: toggleAssetPin,
    recentIds: recentAssetIds,
    markRecent: markRecentAsset,
  } = useAssets();

  const [placed, setPlaced] = useState<PlacedFixture[]>([]);
  const [texts, setTexts] = useState<PlacedText[]>([]);
  const [dimensions, setDimensions] = useState<PlacedDimension[]>([]);
  const [planImages, setPlanImages] = useState<PlacedImage[]>([]);
  const [planBackgrounds, setPlanBackgrounds] = useState<PlacedImage[]>([]);
  const [localFixtures, setLocalFixtures] = useState<FixtureDef[]>([]);
  const [designAssets, setDesignAssets] = useState<DesignAsset[]>([]);
  const [products, setProducts] = useState<Product[]>([]); // 제품 라이브러리(프로젝트 단위) v0.9.3
  const [placedProducts, setPlacedProducts] = useState<PlacedProduct[]>([]); // 배치 제품(배치안) v0.9.3
  const [productPresets, setProductPresets] = useState<ProductPreset[]>([]); // 진열 프리셋(프로젝트 단위) v0.9.4
  const [svgDocuments, setSvgDocuments] = useState<SvgDocument[]>([]);
  const [wallItems, setWallItems] = useState<WallItems>(emptyWallItems());
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [selectedFixtureIds, setSelectedFixtureIds] = useState<string[]>([]); // 다중 선택 (v0.9.0)
  const [selectedSvgElementId, setSelectedSvgElementId] = useState<string | null>(null);
  const [gridSizeMm, setGridSizeMm] = useState(DEFAULT_GRID_SIZE_MM);
  const [snapEnabled, setSnapEnabled] = useState(true); // 그리드 스냅 on/off (v0.9.5 Settings)
  const [importWizardOpen, setImportWizardOpen] = useState(false); // 도면 가져오기 마법사 (v0.9.6)
  const [viewMode, setViewMode] = useState<ViewMode>('plan');
  // 평면도 보기 회전(deg) — 보기 전용 변환. 실제 좌표는 바꾸지 않음. (UI 상태, 저장 안 함)
  const [viewRotationDeg, setViewRotationDeg] = useState(0);
  // 부스 외곽 편집 모드 (CAD 스타일 Shape Editor) — v0.8.6
  const [shapeEditMode, setShapeEditMode] = useState(false);
  const shapeSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFixtureNames, setShowFixtureNames] = useState(true);

  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [currentLayoutId, setCurrentLayoutId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

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
      setDesignAssets(latest?.designAssets ? cloneDesignAssets(latest.designAssets) : []);
      setProducts(found?.products ? cloneProducts(found.products) : []);
      setPlacedProducts(latest?.placedProducts ? clonePlacedProducts(latest.placedProducts) : []);
      setProductPresets(found?.productPresets ? found.productPresets.map((p) => ({ ...p, items: p.items.map((i) => ({ ...i })) })) : []);
      setSvgDocuments(latest?.svgDocuments ? cloneSvgDocs(latest.svgDocuments) : []);
      setWallItems(cloneWallItems(normalizeWallItems(latest?.wallItems)));
      setCurrentLayoutId(latest?.id ?? null);
      setSelectedItem(null);
      setSelectedSvgElementId(null);
      setProjectLoading(false);
      histResetPending.current = true; // 새 프로젝트 로드 시 히스토리 초기화
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  // ---------- Undo/Redo 히스토리 (v0.9.0) ----------
  // 편집 상태 스냅샷을 debounce 로 기록(액션 단위). Cloud/Auto Save 와 독립(별도 effect).
  const MAX_HISTORY = 200;
  const histPast = useRef<HistorySnap[]>([]);
  const histFuture = useRef<HistorySnap[]>([]);
  const histBaseline = useRef<HistorySnap | null>(null);
  const histApplying = useRef(false); // undo/redo 적용 중(기록 스킵)
  const histResetPending = useRef(false); // 프로젝트 로드 직후 baseline 재설정
  const [histVersion, setHistVersion] = useState(0);

  const captureSnapshot = (): HistorySnap => ({
    placed,
    texts,
    dimensions,
    planImages,
    planBackgrounds,
    localFixtures,
    designAssets,
    placedProducts,
    svgDocuments,
    wallItems,
    boothConfig: project?.boothConfig ?? null,
  });

  const applySnapshot = (s: HistorySnap) => {
    histApplying.current = true;
    setPlaced(s.placed);
    setTexts(s.texts);
    setDimensions(s.dimensions);
    setPlanImages(s.planImages);
    setPlanBackgrounds(s.planBackgrounds);
    setLocalFixtures(s.localFixtures);
    setDesignAssets(s.designAssets);
    setPlacedProducts(s.placedProducts);
    setSvgDocuments(s.svgDocuments);
    setWallItems(s.wallItems);
    if (s.boothConfig) setProject((p) => (p ? { ...p, boothConfig: s.boothConfig! } : p));
  };

  // 편집 상태가 바뀌면(설정 후 350ms 안정) 스냅샷 기록. 참조 동일성으로 변경 감지.
  useEffect(() => {
    if (histResetPending.current) {
      histResetPending.current = false;
      histApplying.current = false;
      histBaseline.current = captureSnapshot();
      histPast.current = [];
      histFuture.current = [];
      setHistVersion((v) => v + 1);
      return;
    }
    if (histApplying.current) {
      histApplying.current = false;
      histBaseline.current = captureSnapshot();
      setHistVersion((v) => v + 1);
      return;
    }
    const t = setTimeout(() => {
      const base = histBaseline.current;
      const snap = captureSnapshot();
      if (base && sameHistorySnap(base, snap)) return;
      if (base) {
        histPast.current.push(base);
        if (histPast.current.length > MAX_HISTORY) histPast.current.shift();
      }
      histFuture.current = [];
      histBaseline.current = snap;
      setHistVersion((v) => v + 1);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, texts, dimensions, planImages, planBackgrounds, localFixtures, designAssets, placedProducts, svgDocuments, wallItems, project?.boothConfig]);

  // 다중 선택은 집기 선택 시에만 유효 — 다른 타입/해제 시 정리 (v0.9.0)
  useEffect(() => {
    if (!selectedItem || selectedItem.type !== 'fixture') setSelectedFixtureIds([]);
  }, [selectedItem]);

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
  const selectedProductId =
    selectedItem?.scope === 'plan' && selectedItem.type === 'product' ? selectedItem.id : null;

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
    void histVersion; // canUndo/canRedo 를 히스토리 변경 시 갱신하기 위한 재계산 트리거
    const boothW = project?.boothConfig.widthMm ?? 0;
    const boothD = project?.boothConfig.depthMm ?? 0;
    const boothH = project?.boothConfig.heightMm ?? 0;

    const updateWall = (wall: WallSide, updater: (g: WallItems[WallSide]) => WallItems[WallSide]) =>
      setWallItems((prev) => ({ ...prev, [wall]: updater(prev[wall]) }));

    // 사용할 벽면 ON/OFF (프로젝트 boothConfig 에 저장)
    const setWallEnabled = async (side: WallSide, enabled: boolean) => {
      if (!project) return;
      const usedWalls = { ...(project.boothConfig.usedWalls ?? {}), [side]: enabled };
      const updated: Project = { ...project, boothConfig: { ...project.boothConfig, usedWalls }, updatedAt: Date.now() };
      setProject(updated);
      // 현재 보고 있는 벽면을 끄면 평면도로 전환 (출력/캔버스 일관성)
      if (!enabled && viewMode === side) setViewMode('plan');
      await storage.saveProject(updated);
    };

    // 부스 스타일링(바닥/벽 재질·환경) 갱신 (v0.9.8) → boothConfig 에 임베드(자동 저장/Undo/공유)
    const updateBoothStyling = (patch: Partial<BoothStyling>) => {
      if (!project) return;
      const styling = { ...(project.boothConfig.styling ?? {}), ...patch };
      const updated: Project = {
        ...project,
        boothConfig: { ...project.boothConfig, styling },
        updatedAt: Date.now(),
      };
      setProject(updated);
      if (shapeSaveTimer.current) clearTimeout(shapeSaveTimer.current);
      shapeSaveTimer.current = setTimeout(() => void storage.saveProject(updated), 800);
    };
    const applyStylePreset = (id: StylePresetId) => updateBoothStyling(stylingFromPreset(id));

    // 부스 외곽 폴리곤 갱신 (드래그 중 자주 호출) → 상태 즉시, 저장은 디바운스
    const updateBoothShape = (points: PointMm[]) => {
      if (!project || points.length < 3) return;
      const xs = points.map((p) => p.xMm);
      const ys = points.map((p) => p.yMm);
      const widthMm = Math.max(...xs) - Math.min(...xs);
      const depthMm = Math.max(...ys) - Math.min(...ys);
      const updated: Project = {
        ...project,
        boothConfig: {
          ...project.boothConfig,
          boothShape: 'polygon',
          polygonPoints: points.map((p) => ({ xMm: Math.round(p.xMm), yMm: Math.round(p.yMm) })),
          widthMm: Math.round(widthMm),
          depthMm: Math.round(depthMm),
        },
        updatedAt: Date.now(),
      };
      setProject(updated);
      if (shapeSaveTimer.current) clearTimeout(shapeSaveTimer.current);
      shapeSaveTimer.current = setTimeout(() => {
        void storage.saveProject(updated);
      }, 800);
    };

    // ---------- 집기 (plan) ----------
    const place = (def: FixtureDef) => {
      const x = snapMmToGrid(boothW / 2 - def.widthMm / 2, gridSizeMm);
      const y = snapMmToGrid(boothD / 2 - def.depthMm / 2, gridSizeMm);
      const id = generateId();
      setPlaced((prev) => [...prev, { id, fixtureDefId: def.id, xMm: x, yMm: y, rotationDeg: 0 }]);
      setSelectedItem({ scope: 'plan', type: 'fixture', id });
    };

    // 에셋 배치 (v0.9.7): 에셋 → 배치안 로컬 집기 정의 생성 + 디자인 매핑(썸네일)까지 함께 배치.
    // 기존 집기/디자인 파이프라인을 그대로 타므로 2D/3D/조명/재질/Undo/저장이 자동 동작합니다.
    const placeAsset = (asset: Asset) => {
      const defId = generateId();
      const def = fixtureDefFromAsset(asset, defId);
      setLocalFixtures((prev) => [...prev, def]);

      // 썸네일 이미지가 있으면 디자인 에셋 + 매핑(applyAll)으로 모든 면에 반영
      let design: DesignMapping | undefined;
      const imgUrl = asset.thumbnailUrl ?? asset.previewImageUrl;
      if (imgUrl) {
        const daId = generateId();
        setDesignAssets((prev) => [
          ...prev,
          { id: daId, name: asset.name, kind: 'raster', url: imgUrl, createdAt: Date.now() },
        ]);
        design = {
          applyAll: true,
          faces: { front: { assetId: daId, mode: 'contain', transform: { ...DEFAULT_TEXTURE_TRANSFORM } } },
        };
      }

      const x = snapMmToGrid(boothW / 2 - def.widthMm / 2, gridSizeMm);
      const y = snapMmToGrid(boothD / 2 - def.depthMm / 2, gridSizeMm);
      const id = generateId();
      setPlaced((prev) => [...prev, { id, fixtureDefId: defId, xMm: x, yMm: y, rotationDeg: 0, design }]);
      setSelectedItem({ scope: 'plan', type: 'fixture', id });
      markRecentAsset(asset.id);
    };

    // 배치된 집기 → 에셋 등록 (v0.9.7). 저장은 호출부에서 saveAsset 으로 수행하도록 객체만 생성.
    const createAssetFromFixture = (fixtureId: string, patch?: Partial<Asset>): Asset | null => {
      const pf = placed.find((p) => p.id === fixtureId);
      const def = pf ? fixturesById.get(pf.fixtureDefId) : null;
      if (!def) return null;
      const now = Date.now();
      const dm = pf?.design ? (pf.design.faces.front ?? pf.design.faces.top ?? null) : null;
      const da = dm ? designAssets.find((a) => a.id === dm.assetId) : null;
      return {
        id: generateId(),
        name: def.name,
        category: 'furniture',
        widthMm: def.widthMm,
        depthMm: def.depthMm,
        heightMm: def.heightMm,
        color: def.color,
        material: def.material,
        modelType: def.shape === 'circle' ? 'cylinder' : 'box',
        thumbnailUrl: da?.url,
        visibility: 'private',
        version: 1,
        createdAt: now,
        updatedAt: now,
        ...patch,
      };
    };
    // 집기 선택 (additive=true 면 다중 선택 토글) — v0.9.0
    const select = (id: string | null, additive = false) => {
      if (id == null) {
        setSelectedItem(null);
        setSelectedFixtureIds([]);
        return;
      }
      if (additive) {
        setSelectedFixtureIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      } else {
        setSelectedFixtureIds((prev) => (prev.length > 1 && prev.includes(id) ? prev : [id]));
      }
      setSelectedItem({ scope: 'plan', type: 'fixture', id });
    };
    // 집기에 올려진 제품을 함께 이동/회전 (§1, v1.0.0-pre)
    const shiftAttachedProducts = (fixtureId: string, dx: number, dy: number) => {
      if (!dx && !dy) return;
      setPlacedProducts((prev) => prev.map((pp) => (pp.fixtureId === fixtureId ? { ...pp, xMm: pp.xMm + dx, yMm: pp.yMm + dy } : pp)));
    };
    const rotateAttachedProducts = (fixtureId: string, deltaDeg: number) => {
      if (!deltaDeg) return;
      const pf = placed.find((p) => p.id === fixtureId);
      const def = pf ? fixturesById.get(pf.fixtureDefId) : null;
      if (!pf || !def) return;
      const surf = getFixtureSurface(pf, def);
      const rad = (deltaDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      setPlacedProducts((prev) =>
        prev.map((pp) => {
          if (pp.fixtureId !== fixtureId) return pp;
          const dx = pp.xMm - surf.centerX;
          const dy = pp.yMm - surf.centerY;
          return {
            ...pp,
            xMm: surf.centerX + dx * cos - dy * sin,
            yMm: surf.centerY + dx * sin + dy * cos,
            rotationDeg: (((pp.rotationDeg + deltaDeg) % 360) + 360) % 360,
          };
        }),
      );
    };

    const move = (id: string, xMm: number, yMm: number, snapToGrid = true) => {
      const doSnap = snapToGrid && snapEnabled;
      const nx = doSnap ? snapMmToGrid(xMm, gridSizeMm) : xMm;
      const ny = doSnap ? snapMmToGrid(yMm, gridSizeMm) : yMm;
      const cur = placed.find((p) => p.id === id);
      setPlaced((prev) => prev.map((p) => (p.id === id ? { ...p, xMm: nx, yMm: ny } : p)));
      if (cur) shiftAttachedProducts(id, nx - cur.xMm, ny - cur.yMm); // 집기 위 제품도 함께 이동
    };
    const setSelectedPosition = (xMm: number, yMm: number) => {
      if (!selectedFixtureId) return;
      const cur = placed.find((p) => p.id === selectedFixtureId);
      setPlaced((prev) => prev.map((p) => (p.id === selectedFixtureId ? { ...p, xMm, yMm } : p)));
      if (cur) shiftAttachedProducts(selectedFixtureId, xMm - cur.xMm, yMm - cur.yMm);
    };
    const setSelectedRotation = (deg: number) => {
      if (!selectedFixtureId) return;
      const cur = placed.find((p) => p.id === selectedFixtureId);
      const nd = ((deg % 360) + 360) % 360;
      setPlaced((prev) => prev.map((p) => (p.id === selectedFixtureId ? { ...p, rotationDeg: nd } : p)));
      if (cur) rotateAttachedProducts(selectedFixtureId, nd - cur.rotationDeg);
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
    const addBackground = (
      input: NewImageInput,
      opts?: { xMm?: number; yMm?: number; opacity?: number; locked?: boolean },
    ) => {
      const bg: PlacedImage = {
        id: generateId(),
        name: input.name,
        srcDataUrl: input.srcDataUrl,
        xMm: opts?.xMm ?? 0,
        yMm: opts?.yMm ?? 0,
        widthMm: input.widthMm,
        heightMm: input.heightMm,
        rotationDeg: 0,
        opacity: opts?.opacity ?? 0.8,
        locked: opts?.locked ?? false,
      };
      setPlanBackgrounds((prev) => [...prev, bg]);
      setSelectedItem({ scope: 'plan', type: 'background', id: bg.id });
    };
    const selectBackground = (id: string | null) => setSelectedItem(id ? { scope: 'plan', type: 'background', id } : null);
    const updatePlanBackground = (id: string, patch: Partial<PlacedImage>) =>
      setPlanBackgrounds((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
    const deleteBackground = (id: string) => {
      setPlanBackgrounds((prev) => prev.filter((b) => b.id !== id));
      setSelectedItem((cur) => (cur?.scope === 'plan' && cur.type === 'background' && cur.id === id ? null : cur));
    };

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
    const updateLocalFixture = (defId: string, patch: Partial<FixtureDef>) =>
      setLocalFixtures((prev) => prev.map((f) => (f.id === defId ? { ...f, ...patch } : f)));

    // 출력물 제작(v0.8.9): printSettings 는 FixtureDef 에 저장.
    // 로컬 집기(배치안 임베드) → 배치안 자동/클라우드 저장에 포함.
    // 전역 라이브러리 집기 → storage.saveFixture 로 즉시 영속(클라우드 반영).
    const updateFixturePrintSettings = (
      defId: string,
      printSettings: import('../../types').PrintSettings,
    ) => {
      if (localFixtures.some((f) => f.id === defId)) {
        updateLocalFixture(defId, { printSettings });
      } else {
        const def = fixtures.find((f) => f.id === defId);
        if (def) void saveFixture({ ...def, printSettings });
      }
    };

    // 3D 재질 설정 (v0.9.2) — 로컬/전역 자동 판별 저장
    const updateFixtureMaterial = (defId: string, material: import('../../types').FixtureMaterial) => {
      if (localFixtures.some((f) => f.id === defId)) {
        updateLocalFixture(defId, { material });
      } else {
        const def = fixtures.find((f) => f.id === defId);
        if (def) void saveFixture({ ...def, material });
      }
    };

    // ---------- 디자인 매핑 (v0.8.7) ----------
    const addDesignAsset = (asset: DesignAsset) => setDesignAssets((prev) => [...prev, asset]);
    const updateFixtureDesign = (fixtureId: string, design: DesignMapping | undefined) =>
      setPlaced((prev) => prev.map((p) => (p.id === fixtureId ? { ...p, design } : p)));
    const replaceDesignAsset = (assetId: string, patch: Partial<DesignAsset>) =>
      setDesignAssets((prev) => prev.map((a) => (a.id === assetId ? { ...a, ...patch } : a)));
    const deleteDesignAsset = (assetId: string) => {
      setDesignAssets((prev) => prev.filter((a) => a.id !== assetId));
      setPlaced((prev) =>
        prev.map((p) => {
          if (!p.design) return p;
          const faces = { ...p.design.faces };
          let changed = false;
          for (const k of Object.keys(faces) as (keyof typeof faces)[]) {
            if (faces[k]?.assetId === assetId) {
              delete faces[k];
              changed = true;
            }
          }
          // 추가 레이어(overlays)에서도 해당 에셋 제거 (v1.0.6)
          let overlays = p.design.overlays;
          if (overlays) {
            const nextOv: NonNullable<typeof overlays> = {};
            for (const k of Object.keys(overlays) as (keyof typeof overlays)[]) {
              const kept = (overlays[k] ?? []).filter((m) => m.assetId !== assetId);
              if (kept.length !== (overlays[k] ?? []).length) changed = true;
              if (kept.length) nextOv[k] = kept;
            }
            overlays = Object.keys(nextOv).length > 0 ? nextOv : undefined;
          }
          if (!changed) return p;
          const hasAny = Object.keys(faces).length > 0 || (overlays && Object.keys(overlays).length > 0);
          return hasAny ? { ...p, design: { ...p.design, faces, overlays } } : { ...p, design: undefined };
        }),
      );
    };

    // ---------- Digital Merchandising (v0.9.3) ----------
    // 제품 라이브러리: 프로젝트 단위 저장(즉시 Cloud/Auto Save via saveProject)
    const persistProducts = (next: Product[]) => {
      setProducts(next);
      setProject((p) => (p ? { ...p, products: next } : p));
      if (project) void storage.saveProject({ ...project, products: next, updatedAt: Date.now() });
    };
    const addProduct = (p: Product) => persistProducts([...products, p]);
    const updateProduct = (id: string, patch: Partial<Product>) =>
      persistProducts(products.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const deleteProduct = (id: string) => {
      persistProducts(products.filter((x) => x.id !== id));
      setPlacedProducts((prev) => prev.filter((pp) => pp.productId !== id));
    };

    // 제품 배치(배치안 단위 → Undo/Auto/Cloud/Share 자동). 제품은 항상 집기 Display Surface 위 (v0.9.4)
    const selectProduct = (id: string | null) =>
      setSelectedItem(id ? { scope: 'plan', type: 'product', id } : null);
    /** 배치 대상 집기(선택된 집기 우선) */
    const targetFixtureId = (): string | null =>
      selectedItem?.scope === 'plan' && selectedItem.type === 'fixture' ? selectedItem.id : null;

    const placeProduct = (productId: string, hintFixtureId?: string) => {
      const prod = products.find((p) => p.id === productId);
      if (!prod) return;
      const target = pickTargetFixture(placed, fixturesById, hintFixtureId ?? targetFixtureId(), boothW / 2, boothD / 2);
      if (!target) return; // 집기 없으면 배치 불가(바닥 진열 금지)
      const surf = getFixtureSurface(target.pf, target.def);
      const id = generateId();
      const base: PlacedProduct = {
        id,
        productId,
        fixtureId: target.pf.id,
        xMm: surf.centerX - (prod.widthMm / 2),
        yMm: surf.centerY - (prod.depthMm / 2),
        rotationDeg: 0,
        scale: 1,
        facing: prod.displayDirection ?? 'front',
      };
      const clamped = clampToSurface(prod, base, surf);
      setPlacedProducts((prev) => [...prev, { ...base, ...clamped }]);
      setSelectedItem({ scope: 'plan', type: 'product', id });
    };

    /** 소속 집기 상판으로 위치 제한 (없으면 그대로) */
    const constrainToSurface = (pp: PlacedProduct, x: number, y: number): { xMm: number; yMm: number } => {
      const prod = products.find((p) => p.id === pp.productId);
      const pf = pp.fixtureId ? placed.find((f) => f.id === pp.fixtureId) : null;
      const def = pf ? fixturesById.get(pf.fixtureDefId) : null;
      if (!prod || !pf || !def) return { xMm: x, yMm: y };
      const surf = getFixtureSurface(pf, def);
      return clampToSurface(prod, { ...pp, xMm: x, yMm: y }, surf);
    };

    const moveProduct = (id: string, xMm: number, yMm: number, snap = true) =>
      setPlacedProducts((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          if (p.lock) return p; // Display Lock: 이동 금지
          const doSnap = snap && snapEnabled;
          const nx = doSnap ? snapMmToGrid(xMm, gridSizeMm) : xMm;
          const ny = doSnap ? snapMmToGrid(yMm, gridSizeMm) : yMm;
          const c = constrainToSurface(p, nx, ny); // 상판 밖이면 자동 복귀
          return { ...p, xMm: c.xMm, yMm: c.yMm };
        }),
      );
    const updatePlacedProduct = (id: string, patch: Partial<PlacedProduct>) =>
      setPlacedProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const deletePlacedProduct = (id: string) => {
      setPlacedProducts((prev) => prev.filter((p) => p.id !== id));
      setSelectedItem(null);
    };
    const duplicatePlacedProduct = (id: string) => {
      const nid = generateId();
      setPlacedProducts((prev) => {
        const src = prev.find((p) => p.id === id);
        if (!src) return prev;
        const moved = constrainToSurface(src, src.xMm + gridSizeMm, src.yMm + gridSizeMm);
        return [...prev, { ...src, id: nid, xMm: moved.xMm, yMm: moved.yMm, lock: false }];
      });
      setSelectedItem({ scope: 'plan', type: 'product', id: nid });
    };
    const replacePlacedProduct = (id: string, newProductId: string) =>
      setPlacedProducts((prev) => prev.map((p) => (p.id === id ? { ...p, productId: newProductId } : p)));
    /** 한 번에 제품 교체: 특정 제품의 모든 배치 인스턴스를 신제품으로 (⑦) */
    const replaceProductEverywhere = (oldProductId: string, newProductId: string) =>
      setPlacedProducts((prev) => prev.map((p) => (p.productId === oldProductId ? { ...p, productId: newProductId } : p)));

    // 선택 집기 위 제품 정렬/균등 배치 (§4, v1.0.0-pre)
    const arrangeProductsOnFixture = (fixtureId: string, mode: 'center' | 'distributeH' | 'distributeV' | 'front') => {
      const pf = placed.find((p) => p.id === fixtureId);
      const def = pf ? fixturesById.get(pf.fixtureDefId) : null;
      if (!pf || !def) return;
      const surf = getFixtureSurface(pf, def);
      const kids = placedProducts.filter((pp) => pp.fixtureId === fixtureId);
      if (kids.length === 0) return;
      const sizeOf = (pp: PlacedProduct) => {
        const prod = products.find((x) => x.id === pp.productId);
        const s = pp.scale || 1;
        return { w: (prod?.widthMm ?? 100) * s, d: (prod?.depthMm ?? 100) * s };
      };
      const patchMap = new Map<string, { xMm: number; yMm: number }>();

      if (mode === 'center') {
        // 그룹 바운딩 박스를 상판 중심에 정렬
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const pp of kids) {
          const { w, d } = sizeOf(pp);
          minX = Math.min(minX, pp.xMm); minY = Math.min(minY, pp.yMm);
          maxX = Math.max(maxX, pp.xMm + w); maxY = Math.max(maxY, pp.yMm + d);
        }
        const dx = surf.centerX - (minX + maxX) / 2;
        const dy = surf.centerY - (minY + maxY) / 2;
        for (const pp of kids) patchMap.set(pp.id, { xMm: pp.xMm + dx, yMm: pp.yMm + dy });
      } else if (mode === 'front') {
        // 상판 앞쪽(+Y) 가장자리로 정렬
        for (const pp of kids) {
          const { d } = sizeOf(pp);
          patchMap.set(pp.id, { xMm: pp.xMm, yMm: Math.max(surf.minY, surf.maxY - d - 20) });
        }
      } else if (mode === 'distributeH') {
        const sorted = [...kids].sort((a, b) => a.xMm - b.xMm);
        const totalW = sorted.reduce((s, pp) => s + sizeOf(pp).w, 0);
        const gap = Math.max(0, (surf.maxX - surf.minX - totalW) / (sorted.length + 1));
        let cx = surf.minX + gap;
        for (const pp of sorted) {
          const { w, d } = sizeOf(pp);
          patchMap.set(pp.id, { xMm: cx, yMm: surf.centerY - d / 2 });
          cx += w + gap;
        }
      } else {
        // distributeV
        const sorted = [...kids].sort((a, b) => a.yMm - b.yMm);
        const totalD = sorted.reduce((s, pp) => s + sizeOf(pp).d, 0);
        const gap = Math.max(0, (surf.maxY - surf.minY - totalD) / (sorted.length + 1));
        let cy = surf.minY + gap;
        for (const pp of sorted) {
          const { w, d } = sizeOf(pp);
          patchMap.set(pp.id, { xMm: surf.centerX - w / 2, yMm: cy });
          cy += d + gap;
        }
      }

      setPlacedProducts((prev) =>
        prev.map((pp) => {
          const patch = patchMap.get(pp.id);
          if (!patch) return pp;
          const prod = products.find((x) => x.id === pp.productId);
          const clamped = prod ? clampToSurface(prod, { ...pp, ...patch }, surf) : patch;
          return { ...pp, ...clamped };
        }),
      );
    };

    const gridArrangeProduct = (
      productId: string,
      count: number,
      opts?: { spacingXMm?: number; spacingYMm?: number; cols?: number; scale?: number; facing?: ProductFacing; fixtureId?: string; pattern?: import('../products/productModel').ArrangePattern; radiusMm?: number },
    ) => {
      const prod = products.find((p) => p.id === productId);
      if (!prod) return;
      const target = pickTargetFixture(placed, fixturesById, opts?.fixtureId ?? targetFixtureId(), boothW / 2, boothD / 2);
      if (!target) return;
      const surf = getFixtureSurface(target.pf, target.def);
      const arr = gridArrangeProducts(productId, prod, count, {
        originXMm: surf.minX,
        originYMm: surf.minY,
        ...opts,
      }).map((pp) => {
        const c = clampToSurface(prod, pp, surf);
        return { ...pp, fixtureId: target.pf.id, xMm: c.xMm, yMm: c.yMm };
      });
      if (arr.length) setPlacedProducts((prev) => [...prev, ...arr]);
    };

    // ---------- Merchandising Preset System (v0.9.4) ----------
    const persistPresets = (next: ProductPreset[]) => {
      setProductPresets(next);
      setProject((p) => (p ? { ...p, productPresets: next } : p));
      if (project) void storage.saveProject({ ...project, productPresets: next, updatedAt: Date.now() });
    };
    /** 집기의 현재 진열을 프리셋으로 저장 (집기 로컬 상대 좌표) */
    const saveFixtureAsPreset = (fixtureId: string, name: string) => {
      const pf = placed.find((f) => f.id === fixtureId);
      const def = pf ? fixturesById.get(pf.fixtureDefId) : null;
      if (!pf || !def) return;
      const items: ProductPresetItem[] = placedProducts
        .filter((pp) => pp.fixtureId === fixtureId)
        .map((pp) => ({
          productId: pp.productId,
          dxMm: pp.xMm - pf.xMm,
          dyMm: pp.yMm - pf.yMm,
          rotationDeg: pp.rotationDeg,
          scale: pp.scale,
          facing: pp.facing,
        }));
      if (items.length === 0) return;
      const preset: ProductPreset = { id: generateId(), name: name || '새 프리셋', items, createdAt: Date.now(), sourceWidthMm: def.widthMm, sourceDepthMm: def.depthMm };
      persistPresets([...productPresets, preset]);
    };
    /** 프리셋을 집기에 적용 → 제품 자동 생성/배치 */
    const applyPresetToFixture = (fixtureId: string, presetId: string) => {
      const pf = placed.find((f) => f.id === fixtureId);
      const def = pf ? fixturesById.get(pf.fixtureDefId) : null;
      const preset = productPresets.find((p) => p.id === presetId);
      if (!pf || !def || !preset) return;
      const surf = getFixtureSurface(pf, def);
      const newOnes: PlacedProduct[] = [];
      for (const it of preset.items) {
        const prod = products.find((p) => p.id === it.productId);
        if (!prod) continue;
        const base: PlacedProduct = {
          id: generateId(),
          productId: it.productId,
          fixtureId,
          xMm: pf.xMm + it.dxMm,
          yMm: pf.yMm + it.dyMm,
          rotationDeg: it.rotationDeg,
          scale: it.scale,
          facing: it.facing,
        };
        const c = clampToSurface(prod, base, surf);
        newOnes.push({ ...base, ...c });
      }
      if (newOnes.length) setPlacedProducts((prev) => [...prev, ...newOnes]);
    };
    const renamePreset = (id: string, name: string) => persistPresets(productPresets.map((p) => (p.id === id ? { ...p, name } : p)));
    const duplicatePreset = (id: string) => {
      const src = productPresets.find((p) => p.id === id);
      if (!src) return;
      persistPresets([...productPresets, { ...src, id: generateId(), name: `${src.name} 복사본`, createdAt: Date.now(), items: src.items.map((i) => ({ ...i })) }]);
    };
    const deletePreset = (id: string) => persistPresets(productPresets.filter((p) => p.id !== id));
    const importPreset = (preset: ProductPreset) => persistPresets([...productPresets, { ...preset, id: generateId(), createdAt: Date.now() }]);

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
      if (it.type === 'fixture') {
        setPlaced((prev) => prev.map((p) => (p.id === it.id ? { ...p, rotationDeg: (p.rotationDeg + 90) % 360 } : p)));
        rotateAttachedProducts(it.id, 90); // 집기 위 제품도 함께 회전 (§1)
      } else if (it.type === 'product') setPlacedProducts((prev) => prev.map((p) => (p.id === it.id ? { ...p, rotationDeg: (p.rotationDeg + 90) % 360 } : p)));
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
        // 집기 위 제품도 함께 복사(새 집기에 연결) (§1)
        setPlacedProducts((prev) => {
          const kids = prev.filter((pp) => pp.fixtureId === it.id);
          return kids.length
            ? [...prev, ...kids.map((k) => ({ ...k, id: generateId(), fixtureId: newId, xMm: k.xMm + gridSizeMm, yMm: k.yMm + gridSizeMm }))]
            : prev;
        });
        setSelectedItem({ scope: 'plan', type: 'fixture', id: newId });
      } else if (it.type === 'product') {
        setPlacedProducts((prev) => {
          const src = prev.find((p) => p.id === it.id);
          if (!src) return prev;
          return [...prev, { ...src, id: newId, xMm: src.xMm + gridSizeMm, yMm: src.yMm + gridSizeMm }];
        });
        setSelectedItem({ scope: 'plan', type: 'product', id: newId });
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
      if (it.type === 'fixture') {
        setPlaced((prev) => prev.filter((p) => p.id !== it.id));
        // 집기를 지우면 그 위 제품도 함께 제거(바닥에 남지 않도록, §1)
        setPlacedProducts((prev) => prev.filter((pp) => pp.fixtureId !== it.id));
      } else if (it.type === 'product') setPlacedProducts((prev) => prev.filter((p) => p.id !== it.id));
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
      if (it.type === 'fixture') {
        setPlaced((prev) => prev.map((p) => (p.id === it.id ? { ...p, xMm: p.xMm + dxMm, yMm: p.yMm + dyMm } : p)));
        shiftAttachedProducts(it.id, dxMm, dyMm); // 집기 위 제품도 함께 이동 (§1)
      } else if (it.type === 'product') setPlacedProducts((prev) => prev.map((p) => (p.id === it.id ? { ...p, xMm: p.xMm + dxMm, yMm: p.yMm + dyMm } : p)));
      else if (it.type === 'text') mutateSelText((t) => ({ ...t, xMm: t.xMm + dxMm, yMm: t.yMm + dyMm }));
      else if (it.type === 'dimension') mutateSelDim((d) => ({ ...d, startXMm: d.startXMm + dxMm, startYMm: d.startYMm + dyMm, endXMm: d.endXMm + dxMm, endYMm: d.endYMm + dyMm }));
      else if (it.type === 'image') mutateSelImage((i) => ({ ...i, xMm: i.xMm + dxMm, yMm: i.yMm + dyMm }));
      else if (it.type === 'background') mutateSelBackground((b) => ({ ...b, xMm: b.xMm + dxMm, yMm: b.yMm + dyMm }));
    };

    // ---------- Undo / Redo (v0.9.0) ----------
    const undo = () => {
      if (histPast.current.length === 0) return;
      const target = histPast.current.pop()!;
      if (histBaseline.current) histFuture.current.push(histBaseline.current);
      applySnapshot(target);
      histBaseline.current = target;
      setSelectedItem(null);
      setHistVersion((v) => v + 1);
    };
    const redo = () => {
      if (histFuture.current.length === 0) return;
      const target = histFuture.current.pop()!;
      if (histBaseline.current) histPast.current.push(histBaseline.current);
      applySnapshot(target);
      histBaseline.current = target;
      setSelectedItem(null);
      setHistVersion((v) => v + 1);
    };
    const canUndo = histPast.current.length > 0;
    const canRedo = histFuture.current.length > 0;

    // ---------- 다중 선택 + 정렬/분배/미러/배열 (v0.9.0) ----------
    /** 현재 선택된 집기(+def+AABB) 목록 */
    const selectedBoxes = () =>
      placed
        .filter((p) => selectedFixtureIds.includes(p.id))
        .map((p) => {
          const def = fixturesById.get(p.fixtureDefId);
          return def ? { p, def, aabb: computeFixtureAABB(p, def) } : null;
        })
        .filter((b): b is { p: PlacedFixture; def: FixtureDef; aabb: ReturnType<typeof computeFixtureAABB> } => b != null);

    const applyDelta = (deltas: Map<string, { dx: number; dy: number }>) => {
      setPlaced((prev) =>
        prev.map((p) => {
          const d = deltas.get(p.id);
          return d ? { ...p, xMm: p.xMm + d.dx, yMm: p.yMm + d.dy } : p;
        }),
      );
    };

    const alignFixtures = (mode: AlignMode) => {
      const boxes = selectedBoxes();
      if (boxes.length < 2) return;
      const gMinX = Math.min(...boxes.map((b) => b.aabb.minX));
      const gMaxX = Math.max(...boxes.map((b) => b.aabb.maxX));
      const gMinY = Math.min(...boxes.map((b) => b.aabb.minY));
      const gMaxY = Math.max(...boxes.map((b) => b.aabb.maxY));
      const gcx = (gMinX + gMaxX) / 2;
      const gcy = (gMinY + gMaxY) / 2;
      const deltas = new Map<string, { dx: number; dy: number }>();
      for (const b of boxes) {
        let dx = 0;
        let dy = 0;
        const cx = (b.aabb.minX + b.aabb.maxX) / 2;
        const cy = (b.aabb.minY + b.aabb.maxY) / 2;
        switch (mode) {
          case 'left': dx = gMinX - b.aabb.minX; break;
          case 'right': dx = gMaxX - b.aabb.maxX; break;
          case 'centerH': dx = gcx - cx; break;
          case 'top': dy = gMinY - b.aabb.minY; break;
          case 'bottom': dy = gMaxY - b.aabb.maxY; break;
          case 'centerV': dy = gcy - cy; break;
        }
        deltas.set(b.p.id, { dx, dy });
      }
      applyDelta(deltas);
    };

    const distributeFixtures = (axis: 'h' | 'v') => {
      const boxes = selectedBoxes();
      if (boxes.length < 3) return;
      const centerOf = (b: (typeof boxes)[number]) =>
        axis === 'h' ? (b.aabb.minX + b.aabb.maxX) / 2 : (b.aabb.minY + b.aabb.maxY) / 2;
      const sorted = [...boxes].sort((a, b) => centerOf(a) - centerOf(b));
      const first = centerOf(sorted[0]);
      const last = centerOf(sorted[sorted.length - 1]);
      const step = (last - first) / (sorted.length - 1);
      const deltas = new Map<string, { dx: number; dy: number }>();
      sorted.forEach((b, i) => {
        if (i === 0 || i === sorted.length - 1) return;
        const target = first + step * i;
        const cur = centerOf(b);
        deltas.set(b.p.id, axis === 'h' ? { dx: target - cur, dy: 0 } : { dx: 0, dy: target - cur });
      });
      applyDelta(deltas);
    };

    const mirrorFixtures = (axis: 'h' | 'v', copy: boolean) => {
      const boxes = selectedBoxes();
      if (boxes.length === 0) return;
      const gMinX = Math.min(...boxes.map((b) => b.aabb.minX));
      const gMaxX = Math.max(...boxes.map((b) => b.aabb.maxX));
      const gMinY = Math.min(...boxes.map((b) => b.aabb.minY));
      const gMaxY = Math.max(...boxes.map((b) => b.aabb.maxY));
      const gcx = (gMinX + gMaxX) / 2;
      const gcy = (gMinY + gMaxY) / 2;
      // 배치(arrangement) 미러: 각 집기 바운딩 박스를 그룹 중심 기준 반사. 방향은 유지.
      const mirrored = boxes.map((b) => {
        const w = b.aabb.maxX - b.aabb.minX;
        const h = b.aabb.maxY - b.aabb.minY;
        let newMinX = b.aabb.minX;
        let newMinY = b.aabb.minY;
        if (axis === 'h') newMinX = 2 * gcx - b.aabb.maxX;
        else newMinY = 2 * gcy - b.aabb.maxY;
        const dx = newMinX - b.aabb.minX;
        const dy = newMinY - b.aabb.minY;
        void w; void h;
        return { b, dx, dy };
      });
      if (copy) {
        const newOnes: PlacedFixture[] = mirrored.map((m) => ({
          ...m.b.p,
          id: generateId(),
          xMm: m.b.p.xMm + m.dx,
          yMm: m.b.p.yMm + m.dy,
        }));
        setPlaced((prev) => [...prev, ...newOnes]);
        setSelectedFixtureIds(newOnes.map((n) => n.id));
        setSelectedItem({ scope: 'plan', type: 'fixture', id: newOnes[0].id });
      } else {
        const deltas = new Map(mirrored.map((m) => [m.b.p.id, { dx: m.dx, dy: m.dy }] as const));
        applyDelta(deltas);
      }
    };

    const arrayFixtures = (opts: ArrayOptions) => {
      const boxes = selectedBoxes();
      if (boxes.length === 0 || opts.count < 2) return;
      const newOnes: PlacedFixture[] = [];
      if (opts.kind === 'linear') {
        const sx = opts.spacingXMm ?? 0;
        const sy = opts.spacingYMm ?? 0;
        for (const b of boxes) {
          for (let i = 1; i < opts.count; i++) {
            newOnes.push({ ...b.p, id: generateId(), xMm: b.p.xMm + sx * i, yMm: b.p.yMm + sy * i });
          }
        }
      } else {
        // circular: 그룹 중심을 회전 중심으로, count 개를 totalAngle 에 균등 배치(원본 포함)
        const gcx = boxes.reduce((s, b) => s + (b.aabb.minX + b.aabb.maxX) / 2, 0) / boxes.length;
        const gcy = boxes.reduce((s, b) => s + (b.aabb.minY + b.aabb.maxY) / 2, 0) / boxes.length;
        const total = opts.totalAngleDeg ?? 360;
        const step = total / opts.count;
        for (const b of boxes) {
          for (let i = 1; i < opts.count; i++) {
            const phi = step * i;
            const tl = rotatePointDeg(b.p.xMm, b.p.yMm, gcx, gcy, phi);
            newOnes.push({
              ...b.p,
              id: generateId(),
              xMm: tl.x,
              yMm: tl.y,
              rotationDeg: ((b.p.rotationDeg + phi) % 360 + 360) % 360,
            });
          }
        }
      }
      if (newOnes.length === 0) return;
      setPlaced((prev) => [...prev, ...newOnes]);
    };

    const duplicateFixtures = () => {
      const ids = selectedFixtureIds;
      if (ids.length === 0) return;
      const newOnes: PlacedFixture[] = [];
      setPlaced((prev) => {
        const map = new Map(prev.map((p) => [p.id, p] as const));
        for (const id of ids) {
          const src = map.get(id);
          if (src) newOnes.push({ ...src, id: generateId(), xMm: src.xMm + gridSizeMm, yMm: src.yMm + gridSizeMm });
        }
        return [...prev, ...newOnes];
      });
      if (newOnes.length > 0) {
        setSelectedFixtureIds(newOnes.map((n) => n.id));
        setSelectedItem({ scope: 'plan', type: 'fixture', id: newOnes[0].id });
      }
    };

    const deleteFixtures = () => {
      const ids = selectedFixtureIds;
      if (ids.length === 0) return;
      setPlaced((prev) => prev.filter((p) => !ids.includes(p.id)));
      setSelectedFixtureIds([]);
      setSelectedItem(null);
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
        JSON.stringify(designAssets) !== JSON.stringify(currentLayout.designAssets ?? []) ||
        JSON.stringify(placedProducts) !== JSON.stringify(currentLayout.placedProducts ?? []) ||
        JSON.stringify(wallItems) !== JSON.stringify(normalizeWallItems(currentLayout.wallItems))
      : placed.length > 0 || texts.length > 0 || dimensions.length > 0 || planImages.length > 0 || planBackgrounds.length > 0 || svgDocuments.length > 0 || designAssets.length > 0 || placedProducts.length > 0 ||
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
      designAssets: cloneDesignAssets(designAssets),
      placedProducts: clonePlacedProducts(placedProducts),
      svgDocuments: cloneSvgDocs(svgDocuments),
      wallItems: cloneWallItems(wallItems),
    });

    const saveCurrent = async () => {
      const now = Date.now();
      setSaveStatus('saving');
      try {
        if (currentLayout) {
          await persistLayout({ ...currentLayout, ...snapshot(), updatedAt: now });
        } else {
          await persistLayout({ id: generateId(), name: suggestLayoutName(), ...snapshot(), createdAt: now, updatedAt: now });
        }
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    };
    const saveAs = async (name: string) => {
      const now = Date.now();
      setSaveStatus('saving');
      try {
        await persistLayout({ id: generateId(), name: name.trim() || suggestLayoutName(), ...snapshot(), createdAt: now, updatedAt: now });
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    };
    // 배치안 데이터를 편집기 상태에 적용 (null 이면 빈 캔버스)
    const applyLayout = (layout: Layout | null) => {
      setPlaced(layout ? clonePlaced(layout.placedFixtures) : []);
      setTexts(cloneTexts(layout?.texts ?? []));
      setDimensions(cloneDims(layout?.dimensions ?? []));
      setPlanImages(cloneImages(layout?.planImages ?? []));
      setPlanBackgrounds(cloneImages(layout?.planBackgrounds ?? []));
      setLocalFixtures(cloneFixtureDefs(layout?.localFixtures ?? []));
      setDesignAssets(cloneDesignAssets(layout?.designAssets ?? []));
      setPlacedProducts(clonePlacedProducts(layout?.placedProducts ?? []));
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
              designAssets: cloneDesignAssets(src.designAssets ?? []),
              placedProducts: clonePlacedProducts(src.placedProducts ?? []),
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
      readOnly,
      viewRotationDeg,
      setViewRotationDeg,
      canEdit: !readOnly, // v0.8.4: 회전 상태와 무관하게 편집 가능
      setWallEnabled,
      shapeEditMode,
      setShapeEditMode,
      updateBoothShape,
      updateBoothStyling,
      applyStylePreset,
      layouts,
      currentLayoutId,
      dirty,
      saveStatus,
      isCloud: isCloudStorage,
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
      // Asset Library 2.0 (v0.9.7)
      assets,
      assetsLoading,
      saveAsset,
      deleteAsset,
      toggleAssetFavorite,
      toggleAssetPin,
      recentAssetIds,
      placeAsset,
      createAssetFromFixture,
      localFixtures,
      updateLocalFixture,
      updateFixturePrintSettings,
      updateFixtureMaterial,
      designAssets,
      addDesignAsset,
      updateFixtureDesign,
      replaceDesignAsset,
      deleteDesignAsset,
      // Digital Merchandising (v0.9.3)
      products,
      addProduct,
      updateProduct,
      deleteProduct,
      placedProducts,
      selectedProductId,
      selectProduct,
      placeProduct,
      moveProduct,
      updatePlacedProduct,
      deletePlacedProduct,
      duplicatePlacedProduct,
      replacePlacedProduct,
      replaceProductEverywhere,
      arrangeProductsOnFixture,
      gridArrangeProduct,
      productPresets,
      saveFixtureAsPreset,
      applyPresetToFixture,
      renamePreset,
      duplicatePreset,
      deletePreset,
      importPreset,
      placed,
      texts,
      dimensions,
      planImages,
      planBackgrounds,
      wallItems,
      gridSizeMm,
      setGridSizeMm,
      snapEnabled,
      setSnapEnabled,
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
      deleteBackground,
      importWizardOpen,
      openImportWizard: () => setImportWizardOpen(true),
      closeImportWizard: () => setImportWizardOpen(false),
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
      // CAD 생산성 도구 (v0.9.0)
      undo,
      redo,
      canUndo,
      canRedo,
      selectedFixtureIds,
      selectFixture: select,
      alignFixtures,
      distributeFixtures,
      mirrorFixtures,
      arrayFixtures,
      duplicateFixtures,
      deleteFixtures,
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
    assets,
    assetsLoading,
    saveAsset,
    deleteAsset,
    toggleAssetFavorite,
    toggleAssetPin,
    recentAssetIds,
    placed,
    texts,
    dimensions,
    planImages,
    planBackgrounds,
    localFixtures,
    designAssets,
    products,
    placedProducts,
    productPresets,
    selectedProductId,
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
    snapEnabled,
    importWizardOpen,
    layouts,
    currentLayoutId,
    saveStatus,
    projectId,
    readOnly,
    viewRotationDeg,
    shapeEditMode,
    histVersion,
    selectedFixtureIds,
  ]);

  // ---------- 자동 저장 (5초 debounce) ----------
  // 편집 내용이 바뀔 때마다 타이머를 재설정하고, 5초간 변경이 없으면 저장합니다.
  const saveCurrentRef = useRef(value.saveCurrent);
  saveCurrentRef.current = value.saveCurrent;
  useEffect(() => {
    if (readOnly || !value.dirty) return; // 읽기 전용이면 자동 저장 안 함
    const t = setTimeout(() => {
      void saveCurrentRef.current();
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // 편집 내용/선택 배치안이 바뀌면 debounce 타이머 재설정
  }, [
    value.dirty,
    placed,
    texts,
    dimensions,
    planImages,
    planBackgrounds,
    localFixtures,
    svgDocuments,
    wallItems,
    currentLayoutId,
    readOnly,
  ]);

  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

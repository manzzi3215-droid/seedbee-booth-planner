/**
 * 도메인 타입 정의
 *
 * 이 파일은 앱 전반에서 사용하는 핵심 데이터 모델을 정의합니다.
 * 단계가 진행되면서 (행사장, 집기, 배치 등) 타입이 확장됩니다.
 * 지금은 프로젝트의 최소 골격만 정의합니다.
 */

/** 모든 저장 가능한 엔티티가 공유하는 공통 필드 */
export interface BaseEntity {
  id: string;
  createdAt: number; // epoch millis
  updatedAt: number; // epoch millis
}

/** 부스 오픈면 개수 */
export type OpenSide = 1 | 2 | 3;

/** 바닥 종류 (직접입력 시 customFloor 사용) */
export type FloorType = 'pytex' | 'decotile' | 'basic' | 'custom';

/** 부스 바닥 형태. 없으면(구버전) rectangle 로 취급 */
export type BoothShape = 'rectangle' | 'polygon';

/**
 * 행사장(부스) 기본 정보.
 *
 * widthMm/depthMm 는 부스의 바운딩 박스(가로/세로) 크기입니다.
 *  - rectangle: 부스 그 자체 크기
 *  - polygon: polygonPoints 의 바운딩 박스 크기 (치수 라벨/요약용)
 */
export interface BoothConfig {
  widthMm: number; // 부스 가로(mm) — bounding box
  depthMm: number; // 부스 세로(mm) — bounding box
  /** 부스 높이(mm). null 이면 "높이 미설정"(벽면/3D 미리보기 비활성) */
  heightMm: number | null;
  openSide: OpenSide; // 오픈면 (rectangle 전용)
  floorType: FloorType; // 바닥 종류
  customFloorName?: string; // floorType === 'custom' 일 때 사용

  // --- 바닥 형태 (없으면 rectangle) ---
  boothShape?: BoothShape;
  /** boothShape === 'polygon' 일 때 꼭짓점(mm). 시계/반시계 순서 */
  polygonPoints?: PointMm[];
  /**
   * 각 변(꼭짓점 i → i+1)의 곡선 bulge(mm) — v1.0.9 (optional, 하위 호환).
   * polygonPoints 와 같은 개수. 0/미지정이면 직선. 양수=바깥쪽, 음수=안쪽으로 부풀린 원호(2차 베지어).
   * 렌더링(2D 바닥/벽·3D 바닥·출력)은 getBoothOutline 로 촘촘히 테셀레이션해 반영합니다.
   */
  edgeCurves?: number[];

  /**
   * 사용할 벽면 ON/OFF (v0.7.3). 누락/undefined 인 벽면은 ON 으로 취급(하위 호환).
   * OFF 벽면은 벽면 탭/출력/3D 미리보기에서 제외됩니다.
   */
  usedWalls?: Partial<Record<WallSide, boolean>>;

  /**
   * 벽면별 개별 색상 (v1.1.7). 방향(WallSide)별로 벽 표면색을 저장.
   * 2D 평면도(벽 stroke)·벽면 전개도(배경)·3D 미리보기(벽 fill)에 동일 반영.
   * 미지정 벽은 각 렌더러의 기본색을 사용(무회귀). 헬퍼 getWallColor 로 해석.
   */
  wallColors?: Partial<Record<WallSide, string>>;
  /**
   * (레거시/폴백) 예전 단일 벽 색상. 현재는 저장하지 않지만, 과거 데이터 호환을 위해
   * wallColors 에 값이 없을 때 이 값을 모든 벽 기본색으로 사용합니다. (v1.1.7)
   */
  wallColor?: string;

  /** --- Professional Styling System (v0.9.8) --- 바닥/벽 재질·3D 환경·스타일 프리셋 */
  styling?: BoothStyling;
}

/**
 * --- Professional Styling & Decoration System (v0.9.8) ---
 * 실제 제안서 수준의 팝업스토어 시안을 위한 바닥/벽 재질, 3D 환경, 원클릭 스타일 프리셋.
 * 데이터는 boothConfig 에 임베드되어 자동 저장/Undo/공유가 그대로 동작합니다.
 */
export type FloorMaterialId =
  | 'concrete' | 'wood' | 'marble' | 'stone' | 'pvc' | 'carpet' | 'white' | 'black' | 'checker';
export type WallMaterialId =
  | 'paint' | 'wood' | 'fabric' | 'curtain' | 'stone' | 'concrete' | 'ledwall' | 'acrylic';
export type EnvironmentId =
  | 'studioWhite' | 'studioGray' | 'studioBlack' | 'mall' | 'exhibition' | 'transparent';
export type StylePresetId =
  | 'modern' | 'minimal' | 'luxury' | 'natural' | 'beauty' | 'baby' | 'pharmacy' | 'popup';

export interface BoothStyling {
  floorMaterial?: FloorMaterialId;
  wallMaterial?: WallMaterialId;
  environment?: EnvironmentId;
  /** 마지막으로 적용한 스타일 프리셋(표시용) */
  stylePreset?: StylePresetId;
}

/**
 * 집기(fixture) 형태.
 *
 * ⚠️ 확장성 주의: 우리 회사 집기에는 직각 사각형뿐 아니라 코너에 곡선이 들어간
 * 집기, 원형/반원형 집기도 있습니다. 그래서 shape 를 처음부터 union 으로 두어
 * Canvas 렌더링이 사각형에 고정되지 않도록 설계합니다.
 */
export type FixtureShape =
  | 'rectangle'
  | 'roundedRectangle'
  | 'circle'
  | 'semicircle'
  | 'customPath';

/** 3D 재질 (v0.9.2) — 반사/광택/투명 표현 */
export type FixtureMaterial = 'matte' | 'semiGloss' | 'gloss' | 'transparent' | 'acrylic';

/**
 * --- Asset Library 2.0 (v0.9.7) ---
 * 집기·소품·POP·제품·사람·식물·조명 등 자주 쓰는 에셋을 한 곳에서 관리.
 * 사용자 전역(My) / 회사 공용(Company) 라이브러리 구조. 이미지는 경량 dataURL(Storage 참조 필드 확장 대비).
 * 배치는 기존 집기+디자인 매핑 파이프라인을 재사용해 2D/3D/조명/재질/Undo/저장이 자동 동작합니다.
 */
export type AssetCategory =
  | 'furniture'
  | 'displayFixture'
  | 'product'
  | 'pop'
  | 'poster'
  | 'banner'
  | 'decoration'
  | 'plant'
  | 'human'
  | 'lighting'
  | 'wallObject'
  | 'floorObject'
  | 'signage'
  | 'custom';

export type AssetVisibility = 'private' | 'company';
export type AssetModelType = 'box' | 'cylinder' | 'flat' | 'custom';

export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  tags?: string[];
  brand?: string;
  widthMm: number;
  depthMm: number;
  heightMm?: number;
  /** 대표 썸네일(dataURL). Storage 미사용 폴백 */
  thumbnailUrl?: string;
  previewImageUrl?: string;
  /** 향후 Firebase Storage 참조 경로 (assets/users/{uid}/… , assets/company/{companyId}/…) */
  storagePath?: string;
  modelType?: AssetModelType;
  color?: string;
  material?: FixtureMaterial;
  createdAt: number;
  updatedAt: number;
  owner?: string;
  visibility: AssetVisibility;
  /** 에셋 버전 (v0.9.7) */
  version?: number;
  /** 즐겨찾기 */
  favorite?: boolean;
  /** 핀 고정 (목록 상단 고정, v0.9.8) */
  pinned?: boolean;
}

/** 2D 좌표 (mm 기준). Canvas 내부 좌표는 항상 mm 로 관리합니다. */
export interface PointMm {
  xMm: number;
  yMm: number;
}

/**
 * 집기 "정의"(라이브러리 원본). 5단계에서 등록/사용됩니다.
 * shape 별로 필요한 파라미터가 다르므로 선택 필드로 둡니다.
 */
export interface FixtureDef {
  id: string;
  name: string;
  shape: FixtureShape;
  widthMm: number; // 바운딩 박스 가로
  depthMm: number; // 바운딩 박스 세로
  heightMm?: number; // 실물 높이(선택)
  color: string;
  /** 채움 투명도 0~1 (v0.8.5). 누락 시 1(불투명)로 취급 — 하위 호환 */
  opacity?: number;
  /** 3D 재질 (v0.9.2). 누락 시 'matte' — 하위 호환 */
  material?: FixtureMaterial;
  memo?: string;
  /** 폴더/그룹(카테고리) — 라이브러리 그룹화·필터용 (v1.0.9, optional) */
  category?: string;
  /** 정렬 순서 — 드래그 정렬용 (v1.0.9, optional). 미지정 시 추가 순서 */
  order?: number;

  // --- shape 별 파라미터 (해당 shape 일 때만 사용) ---
  cornerRadiusMm?: number; // roundedRectangle
  pathPoints?: PointMm[]; // (예약) points 기반 곡선 정의
  /**
   * customPath 용 SVG path 데이터.
   * 좌표계는 100×100 단위 박스(0~100) 기준으로 작성하며, 렌더링 시
   * widthMm/depthMm 바운딩 박스에 맞춰 (width/100, depth/100) 로 스케일됩니다.
   */
  svgPath?: string;

  /**
   * 출력물 제작(Print Production Workspace, v0.8.9) 설정.
   * 화면 시안용 Design Mapping(PlacedFixture.design) 과 별도로, 실제 출력용 사이즈/블리드/
   * 재단선/안전영역/출력용 변형을 면별로 보관합니다. 누락 시 집기 치수 기준 기본값을 생성합니다.
   */
  printSettings?: PrintSettings;

  /**
   * 커스텀 집기(사용자가 이미지/3D 모델을 불러와 등록) 정보 — v1.1.1 (optional, 하위 호환).
   * 실물 사이즈(realWidthMm/DepthMm/HeightMm)는 widthMm/depthMm/heightMm 에도 반영됩니다.
   */
  customAsset?: CustomAsset;
}

/** 커스텀 집기 에셋 (v1.1.1) — 이미지 또는 3D 모델 기반 */
export interface CustomAsset {
  kind: 'image' | 'model';
  /** 이미지: dataURL(자기완결). 모델: 파일명/포맷만 저장(1차 구현은 placeholder 렌더) */
  fileUrl?: string;
  fileName: string;
  mimeType?: string;
  /** 원본 픽셀 크기(이미지) */
  originalWidth?: number;
  originalHeight?: number;
  modelFormat?: 'glb' | 'gltf' | 'obj';
  /**
   * 3D 모델 원본이 캐시된 IndexedDB 키 (v1.1.6). 보통 FixtureDef.id 와 동일.
   * Firebase Storage 없이도 이 키로 로컬 GLB 를 읽어 실제 렌더합니다. 없으면 placeholder.
   */
  localModelId?: string;
  /** 2D 평면도 표시 방식 */
  display2d?: 'footprint' | 'image' | 'image-footprint';
  /** 3D 표시 방식 */
  display3d?: 'panel' | 'box-texture' | 'top-texture' | 'billboard' | 'model' | 'placeholder';
  /** 입력한 실물 사이즈(mm) — width/depth/height 에도 반영 */
  realWidthMm: number;
  realDepthMm: number;
  realHeightMm: number;
  /** 3D 모델 방향 보정(도) */
  rotationOffset?: { x?: number; y?: number; z?: number };
  /** 스케일 모드 (기본: 실물 사이즈 맞춤) */
  scaleMode?: 'fit-real-size';
}

/**
 * --- Print Production Workspace (v0.8.9) ---
 * 실제 출력업체 전달용 데이터(면별 출력 사이즈/블리드/재단선/안전영역/출력용 변형).
 * 디자인 에셋(이미지)은 Design Mapping(v0.8.7)의 것을 그대로 재사용합니다.
 */

/** 한 면의 출력 설정 */
export interface PrintFaceSettings {
  /** 출력(재단) 사이즈 — 기본은 집기 치수 기준 자동 계산, 수동 수정 가능 */
  widthMm: number;
  heightMm: number;
  /** 블리드(도련) mm */
  bleedMm: number;
  /** 안전영역 mm */
  safeAreaMm: number;
  /** 안전영역 표시 여부 */
  safeAreaOn: boolean;
  /** 재단선(crop mark) 표시 여부 */
  cropMark: boolean;
  /** 출력용 변형 (화면 매핑과 별도) — opacity 는 사용하지 않음(항상 1) */
  transform: TextureTransform;
  /** DPI 계산용 원본 이미지 픽셀 기록(선택) */
  dpiInfo?: { widthPx?: number; heightPx?: number };
}

/** 집기 전체 출력 설정 (면별) */
export interface PrintSettings {
  faces: Partial<Record<BoxFace, PrintFaceSettings>>;
}

/**
 * --- Design Mapping System (v0.8.7) ---
 * 실제 출력 디자인(이미지)을 집기 면에 입히기 위한 구조.
 * 향후 AI/UV/Curve/Cylinder 확장을 위해 Asset(에셋) / Mapping(면 매핑) / Transform 을 분리합니다.
 * 이미지 바이트는 Firebase Storage 에 저장하고, 여기에는 참조(URL)만 둡니다(Base64 금지).
 */

/** 업로드된 디자인 에셋 (프로젝트/배치안 단위) */
export interface DesignAsset {
  id: string;
  name: string; // 파일명
  kind: 'raster' | 'svg';
  url: string; // Storage download URL (또는 미설정 폴백 dataURL)
  storagePath?: string; // Storage 경로 (삭제/교체용)
  widthPx?: number;
  heightPx?: number;
  createdAt: number;
}

/** 매핑 방식 */
export type MappingMode = 'stretch' | 'contain' | 'cover' | 'center' | 'tile';

/** 집기 면 */
export type BoxFace = 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

/** 텍스처 변형 (실시간 프리뷰) */
export interface TextureTransform {
  scale: number; // 1 = 원본
  rotationDeg: number;
  flipH: boolean;
  flipV: boolean;
  offsetX: number; // 면 대비 비율 -1~1
  offsetY: number;
  opacity: number; // 0~1
}

/** 한 면(레이어)의 매핑 (에셋 참조 + 방식 + 변형) */
export interface FaceMapping {
  assetId: string;
  mode: MappingMode;
  transform: TextureTransform;
  /**
   * 이 레이어가 렌더될 면 목록 (v1.0.9). 미지정(기존 데이터)이면 자기 버킷 면에만 적용.
   * 예: ['front','back','left','right','top','bottom'] = 모든 면, ['front'] = 정면만.
   */
  faces?: BoxFace[];
}

/** 집기 전체 디자인 매핑 */
export interface DesignMapping {
  /** 모든 면 동일 적용 (true 면 faces.front 를 모든 면에 사용) */
  applyAll: boolean;
  /** 각 면의 기본(맨 아래) 레이어. (하위 호환 — 기존 구조 그대로) */
  faces: Partial<Record<BoxFace, FaceMapping>>;
  /**
   * 추가 이미지 레이어 (v1.0.6). 같은 면의 base(faces) 위에 순서대로 겹쳐 렌더됩니다(마지막이 최상단).
   * 미지정(기존 저장파일)이면 base 레이어만 있는 것으로 취급 → 100% 하위 호환.
   */
  overlays?: Partial<Record<BoxFace, FaceMapping[]>>;
}

/** 기본 텍스처 변형 */
export const DEFAULT_TEXTURE_TRANSFORM: TextureTransform = {
  scale: 1,
  rotationDeg: 0,
  flipH: false,
  flipV: false,
  offsetX: 0,
  offsetY: 0,
  opacity: 1,
};

/**
 * 배치된 집기(캔버스 위의 인스턴스). 6단계 드래그 배치부터 사용됩니다.
 * 위치/회전은 모두 mm·도(deg) 기준으로 저장하여 화면 배율과 무관하게 유지됩니다.
 */
export interface PlacedFixture {
  id: string;
  fixtureDefId: string; // 원본 FixtureDef 참조
  xMm: number; // 바운딩 박스 좌상단 X (mm)
  yMm: number; // 바운딩 박스 좌상단 Y (mm)
  rotationDeg: number; // 회전 각도(도)
  /** 디자인 매핑 (v0.8.7) — 인스턴스 단위 */
  design?: DesignMapping;
  /**
   * 그룹 id (v1.0.8). 같은 groupId 를 가진 집기는 한 번에 선택·이동됩니다.
   * optional — 미지정 시 그룹 없음(하위 호환).
   */
  groupId?: string;
}

/** 텍스트 정렬 */
export type TextAlign = 'left' | 'center' | 'right';

/**
 * 캔버스 자유 텍스트 (예: "입구", "카운터", "이벤트존").
 * 위치/회전은 mm·도, 글자 크기도 mm(도면 배율과 함께 확대/축소)로 관리합니다.
 */
export interface PlacedText {
  id: string;
  text: string;
  xMm: number;
  yMm: number;
  rotationDeg: number;
  fontSizeMm: number;
  color: string;
  backgroundColor?: string; // 없으면 투명
  bold: boolean;
  align: TextAlign;
  memo?: string;
}

/**
 * 치수선 (예: "10500 mm"). 각도는 시작/끝점에서 자동 계산합니다.
 * label 이 비어 있으면 두 점 사이 거리로 "0000 mm" 형태를 자동 표시합니다.
 */
export interface PlacedDimension {
  id: string;
  startXMm: number;
  startYMm: number;
  endXMm: number;
  endYMm: number;
  label?: string; // 비면 자동 길이 표시
  color: string; // 선 색상
  textColor: string;
  lineWidthPx: number; // 화면 고정 두께(px)
  showArrows: boolean;
  memo?: string;
}

/**
 * 배치된 이미지 (포스터/현수막/TV 화면/로고 등).
 * 위치/크기는 mm, 회전은 deg.
 *
 * ⚠️ srcDataUrl 은 초기 버전에서 이미지를 dataURL(base64)로 인라인 저장합니다.
 * localStorage 용량이 커질 수 있으므로 추후 Firebase Storage(외부 URL) 전환을 권장합니다.
 */
export interface PlacedImage {
  id: string;
  name: string;
  srcDataUrl: string;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  opacity: number; // 0~1
  /** SVG 배경 등에서 사용: 잠금 시 선택/이동 불가 */
  locked?: boolean;
  memo?: string;
}

/**
 * --- SVG Import (v0.7.0) ---
 * Illustrator 등에서 저장한 SVG 를 "단순 이미지"가 아니라 내부 구조를 읽을 수 있는
 * 객체 모델로 가져오기 위한 타입. 이번 버전에서는 "읽기(파싱/검사/하이라이트)"까지만
 * 구현하고, 집기/CustomPath/Background 로의 변환은 다음 버전(v0.7.1)에서 다룹니다.
 */
export type SvgElementType =
  | 'path'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'polygon'
  | 'polyline'
  | 'line'
  | 'text';

/**
 * SVG 내부 도형 하나.
 * bbox 는 문서 전체 대비 정규화 좌표(fx,fy = 좌상단 0..1, fw,fh = 크기 0..1)로 저장해
 * 문서를 mm 로 배치했을 때 위치/크기를 간단히 환산할 수 있게 합니다.
 */
export interface SvgElement {
  id: string;
  type: SvgElementType;
  stroke: string;
  fill: string;
  transform?: string;
  /** 원본 속성 (d, points, x/y/width/height, cx/cy/r 등) — 향후 변환기용 */
  attrs: Record<string, string>;
  /** text 요소일 때 텍스트 내용 */
  text?: string;
  fx: number;
  fy: number;
  fw: number;
  fh: number;
  /** v0.7.1: 집기/치수선으로 변환 완료됨 (중복 변환 방지) */
  converted?: boolean;
}

/** SVG viewBox (없으면 width/height 로 대체) */
export interface SvgViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/**
 * 파싱된 SVG 문서.
 * elements[] 로 내부 도형을 보관하고, metadata(viewBox/크기)와 mm 배치 정보를 가집니다.
 * srcDataUrl 은 미리보기/하이라이트 렌더용 원본 SVG 입니다.
 */
export interface SvgDocument {
  id: string;
  name: string;
  srcDataUrl: string;
  docWidth: number; // SVG 좌표 px
  docHeight: number;
  viewBox: SvgViewBox;
  elements: SvgElement[];
  // 평면도 배치 (mm)
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * --- Digital Merchandising System (v0.9.3) ---
 * 부스 설계 → 제품 진열 → 출력물(Display Guide) → 현장 설치까지 연결하는 제품 컴포넌트 모델.
 * Product(제품 정의) / PlacedProduct(배치 인스턴스) / Package(세트) / Template(행사별) 로 분리하여
 * 2D · 3D · Print · Display Guide 어디서나 동일한 데이터를 사용합니다.
 * 향후 ERP · 재고 · 판매 · AI 자동진열 확장을 위해 확장 필드(meta)와 레이어 구조를 둡니다.
 */

/** 제품 진열 방향 */
export type ProductFacing = 'front' | 'back' | 'left' | 'right';

/**
 * 제품 3D 지오메트리 타입 (v0.9.9). Auto 는 비율을 보고 자동 선택.
 * GLB 없이 현재 Geometry Engine(footprint+extrude)로 가볍게 입체 표현.
 */
export type ProductGeometryType =
  | 'auto' | 'bottle' | 'tube' | 'box' | 'pouch' | 'jar' | 'can' | 'standee' | 'flatCard';

/** 제품 재질 (v0.9.9) */
export type ProductMaterial = 'paper' | 'matte' | 'plastic' | 'glossy' | 'glass' | 'metal';

/**
 * 제품 렌더 모드 (v1.0.0-pre) — 누끼 PNG 가 잘 보이는 실무 방식 우선.
 *  - standingCard: 상판 위에 세워둔 카드/패널(정면 PNG). 기본값
 *  - flatCard: 상판 위에 눕힌 카드(위에서 PNG)
 *  - simpleBox: 단순 박스(모든 면 PNG)
 *  - cylinder: 원기둥(둘레 wrap)
 */
export type ProductRenderMode = 'flatCard' | 'standingCard' | 'simpleBox' | 'cylinder';

/** 제품 배경 처리 (v0.9.9) — 이미지 뒤 배경색 채움 여부 */
export type ProductBackgroundMode = 'solid' | 'transparent';

/** 제품 정의 (Product Component). 프로젝트(행사) 단위 라이브러리에 저장 */
export interface Product {
  id: string;
  sku?: string;
  name: string;
  brand?: string;
  category?: string;
  widthMm: number;
  depthMm: number;
  heightMm?: number;
  weightG?: number;
  /** 대표 썸네일(dataURL) */
  thumbnailUrl?: string;
  /** 면별 이미지(dataURL) — 없으면 thumbnail 사용 */
  images?: Partial<Record<'front' | 'back' | 'left' | 'right' | 'top', string>>;
  /** 진열 색(이미지 없을 때) */
  displayColor?: string;
  /** 배경 처리 (v0.9.9). 'transparent' 면 이미지 뒤 배경색을 채우지 않고 PNG alpha 유지 */
  backgroundMode?: ProductBackgroundMode;
  /** 3D 지오메트리 타입 (v0.9.9). 미지정 시 'auto' */
  geometryType?: ProductGeometryType;
  /** 제품 렌더 모드 (v1.0.0-pre). 미지정 시 'standingCard' */
  renderMode?: ProductRenderMode;
  /** 두께/깊이(mm) 오버라이드 (v0.9.9). 미지정 시 depthMm 사용 */
  thicknessMm?: number;
  /** 3D 재질 (v0.9.9). 미지정 시 'matte' */
  material?: ProductMaterial;
  /** 기본 진열 방향 */
  displayDirection?: ProductFacing;
  /** 권장 페이싱(정면 노출 개수) */
  recommendedFacing?: number;
  /** 권장 제품 간격(mm) */
  recommendedSpacingMm?: number;
  /** 진열 그룹(브랜드/시리즈) */
  displayGroup?: string;
  /** 검색용 태그 (v1.0.2) */
  tags?: string[];
  /** 즐겨찾기 (v1.0.2) */
  favorite?: boolean;
  memo?: string;
  createdAt: number;
  /** 확장 지점 — ERP/재고/판매/AI 연동용(가격, 재고, 판매순위 등) */
  meta?: Record<string, unknown>;
}

/** 배치된 제품 인스턴스 (집기 Display Surface 위, v0.9.4) */
export interface PlacedProduct {
  id: string;
  productId: string;
  /** 소속 집기(Display Surface). 제품은 항상 집기 상판 위에 진열됨 (v0.9.4) */
  fixtureId?: string;
  xMm: number; // 바운딩 박스 좌상단(월드 mm) — 소속 집기 상판 위로 제한됨
  yMm: number;
  rotationDeg: number;
  /** 스케일 배율(1=100%) */
  scale: number;
  /** 진열 방향(자동 회전/이미지 선택) */
  facing: ProductFacing;
  /** 그룹 id(그룹 이동/복사/잠금) */
  groupId?: string;
  /** 진열 잠금(이동 금지) — Display Lock (v0.9.4) */
  lock?: boolean;
  /** 설치 순서(선택) */
  seq?: number;
}

/** 제품 진열 프리셋 아이템 — 집기 상판 기준 상대 좌표 (v0.9.4) */
export interface ProductPresetItem {
  productId: string;
  /** 집기 로컬(좌상단 0,0) 기준 상대 좌표 mm */
  dxMm: number;
  dyMm: number;
  rotationDeg: number;
  scale: number;
  facing: ProductFacing;
}

/** 제품 진열 프리셋 — 빈 집기에 적용하면 진열 자동 완성 (v0.9.4 핵심) */
export interface ProductPreset {
  id: string;
  name: string;
  items: ProductPresetItem[];
  createdAt: number;
  /** 참고: 만든 집기 크기(적용 시 스케일 판단용) */
  sourceWidthMm?: number;
  sourceDepthMm?: number;
}

/** 제품 세트(패키지) — 드래그 한 번으로 세트 전체 배치 (#13) */
export interface ProductPackage {
  id: string;
  name: string;
  items: {
    productId: string;
    dxMm: number;
    dyMm: number;
    rotationDeg: number;
    scale: number;
    facing: ProductFacing;
  }[];
}

/** 행사별 진열 템플릿 (#14) */
export interface ProductTemplate {
  id: string;
  name: string;
  placedProducts: PlacedProduct[];
  createdAt: number;
}

/**
 * --- VMD Board Workspace (v1.0.1) ---
 * 부스 3D 편집과 분리된 독립 2D VMD 시안 보드. 제품 PNG 누끼컷·POP·QR·텍스트·도형을
 * 자유 배치해 현장 DP 시안을 빠르게 제작. 좌표/크기는 mm 기준. 프로젝트에 임베드 저장.
 */
export type VmdElementType = 'product' | 'image' | 'text' | 'shape' | 'line';
export type VmdShapeKind = 'rect' | 'circle';
export type VmdBackgroundMode = 'solid' | 'transparent' | 'image';

export interface VmdBackground {
  mode: VmdBackgroundMode;
  color?: string;
  imageSrc?: string; // dataURL
  outline?: boolean;
  outlineColor?: string;
  radiusMm?: number;
  shadow?: boolean;
  /** 받침대/스탠드 스타일(하단 받침 그림자) */
  pedestal?: boolean;
}

export interface VmdElement {
  id: string;
  type: VmdElementType;
  name: string;
  xMm: number; // 좌상단 X (line 은 시작점)
  yMm: number;
  widthMm: number;
  heightMm: number;
  rotationDeg: number;
  opacity: number;
  hidden?: boolean;
  locked?: boolean;
  // product
  productId?: string;
  // image / qr / pop / logo
  src?: string; // dataURL (PNG alpha 유지)
  // text
  text?: string;
  fontSizeMm?: number;
  color?: string;
  bold?: boolean;
  align?: TextAlign;
  bgColor?: string;
  // shape
  shape?: VmdShapeKind;
  fill?: string;
  stroke?: string;
  strokeWidthMm?: number;
  // line (x/y = 시작, x2/y2 = 끝)
  x2Mm?: number;
  y2Mm?: number;
  arrow?: boolean;
}

export interface VmdBoard {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  background: VmdBackground;
  elements: VmdElement[];
  memo?: string;
  createdAt: number;
  updatedAt: number;
  /** Booth 집기에서 생성된 경우 원본 집기명(참고용) */
  sourceFixtureName?: string;
}

/** VMD 프리셋 (다음 행사에서 다시 불러오기) */
export interface VmdPreset {
  id: string;
  name: string;
  board: Omit<VmdBoard, 'id' | 'createdAt' | 'updatedAt'>;
  /** 즐겨찾기 (v1.0.2) */
  favorite?: boolean;
  /** 태그 (v1.0.2) */
  tags?: string[];
  createdAt: number;
}

/** VMD 사용자 보드 템플릿 (사이즈·배경만, v1.0.2) */
export interface VmdTemplate {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  background: VmdBackground;
  favorite?: boolean;
  createdAt: number;
}

/** 벽면 구분 */
export type WallSide = 'frontWall' | 'leftWall' | 'rightWall' | 'backWall';

/** 한 벽면에 배치된 요소(텍스트/치수선/이미지). 좌표는 벽 로컬 mm. */
export interface WallItemGroup {
  texts: PlacedText[];
  dimensions: PlacedDimension[];
  images: PlacedImage[];
}

/** 벽면별 요소 모음 */
export type WallItems = Record<WallSide, WallItemGroup>;

/**
 * Layout = 하나의 배치안(버전). 예: v1, v2, "체험존 강조안"
 * placedFixtures / texts / dimensions 는 평면도 스냅샷,
 * wallItems 는 벽면별 요소입니다. 모두 하위 호환을 위해 선택 필드입니다.
 */
export interface Layout {
  id: string;
  name: string;
  placedFixtures: PlacedFixture[];
  /**
   * 이 배치안에서만 쓰는 집기 정의 (v0.7.1 SVG→Fixture 변환 결과).
   * 전역 집기 라이브러리(blp:fixtures)에는 저장하지 않고 배치안과 함께 보관합니다.
   */
  localFixtures?: FixtureDef[];
  texts?: PlacedText[];
  dimensions?: PlacedDimension[];
  planImages?: PlacedImage[];
  /** 평면도 SVG 배경 도면 (PlacedImage 재사용, locked 지원) */
  planBackgrounds?: PlacedImage[];
  /** 구조 파싱된 SVG 문서 (v0.7.0 SVG Import) */
  svgDocuments?: SvgDocument[];
  /** 디자인 에셋 (v0.8.7) — 이미지 참조(Storage URL). placedFixtures.design 이 assetId 로 참조 */
  designAssets?: DesignAsset[];
  /** 배치된 제품 (v0.9.3 Merchandising) — Product Layer. products 는 project.products 참조 */
  placedProducts?: PlacedProduct[];
  wallItems?: WallItems;
  createdAt: number;
  updatedAt: number;
}

/** 프로젝트 공개 범위 (v0.8.2) */
export type ProjectVisibility = 'private' | 'shared';

/** 공유 링크 권한 (v0.8.3) */
export type SharePermission = 'view' | 'edit';

/**
 * 프로젝트 = 하나의 행사(예: "메가쇼")
 * layouts 로 여러 배치안 버전을 보관합니다.
 * (Firebase 이전 시 projects/{id}/layouts 서브컬렉션으로 매핑)
 */
export interface Project extends BaseEntity {
  name: string;
  boothConfig: BoothConfig;
  layouts: Layout[];

  // --- 프로젝트 관리 정보 (v1.1.0, optional — 하위 호환) ---
  /** 브랜드/클라이언트 */
  brand?: string;
  /** 행사 기간 (자유 텍스트, 예: 2026-03-01 ~ 03-05) */
  eventPeriod?: string;
  /** 장소/행사장 */
  place?: string;
  /** 담당자 */
  manager?: string;
  /** 메모 */
  projectMemo?: string;

  // --- Digital Merchandising (v0.9.3) — 행사(프로젝트) 단위 제품 라이브러리 ---
  /** 제품 정의 라이브러리 */
  products?: Product[];
  /** 제품 세트(패키지) */
  productPackages?: ProductPackage[];
  /** 행사별 진열 템플릿 */
  productTemplates?: ProductTemplate[];
  /** 진열 프리셋 (v0.9.4) — 집기에 적용하면 진열 자동 완성 */
  productPresets?: ProductPreset[];

  // --- VMD Board Workspace (v1.0.1) — 독립 2D VMD 시안 보드 ---
  /** VMD 보드 목록 */
  vmdBoards?: VmdBoard[];
  /** VMD 프리셋(다음 행사 재사용) */
  vmdPresets?: VmdPreset[];
  /** VMD 사용자 보드 템플릿 (v1.0.2) */
  vmdTemplates?: VmdTemplate[];

  // --- 공유 (v0.8.2). 누락 시 owner 전용/비공개로 취급(하위 호환) ---
  /** Firestore 소유자 uid (읽을 때 채워짐) */
  owner?: string;
  /** 공유 대상 이메일(소문자). 이 이메일 사용자는 읽기+편집 가능 */
  sharedWith?: string[];
  /** 공개 범위: private(나만) | shared(공유됨) */
  visibility?: ProjectVisibility;

  // --- 공유 링크 (v0.8.3) ---
  /** 공유 링크 토큰(랜덤). /share/{shareId} */
  shareId?: string;
  /** 공유 링크 활성 여부 */
  shareEnabled?: boolean;
  /** 공유 링크 권한: view(읽기전용) | edit(수정 가능) */
  sharePermission?: SharePermission;
}

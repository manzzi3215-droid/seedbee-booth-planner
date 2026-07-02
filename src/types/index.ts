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
   * 사용할 벽면 ON/OFF (v0.7.3). 누락/undefined 인 벽면은 ON 으로 취급(하위 호환).
   * OFF 벽면은 벽면 탭/출력/3D 미리보기에서 제외됩니다.
   */
  usedWalls?: Partial<Record<WallSide, boolean>>;
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
  memo?: string;

  // --- shape 별 파라미터 (해당 shape 일 때만 사용) ---
  cornerRadiusMm?: number; // roundedRectangle
  pathPoints?: PointMm[]; // (예약) points 기반 곡선 정의
  /**
   * customPath 용 SVG path 데이터.
   * 좌표계는 100×100 단위 박스(0~100) 기준으로 작성하며, 렌더링 시
   * widthMm/depthMm 바운딩 박스에 맞춰 (width/100, depth/100) 로 스케일됩니다.
   */
  svgPath?: string;
}

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
  wallItems?: WallItems;
  createdAt: number;
  updatedAt: number;
}

/**
 * 프로젝트 = 하나의 행사(예: "메가쇼")
 * layouts 로 여러 배치안 버전을 보관합니다.
 * (Firebase 이전 시 projects/{id}/layouts 서브컬렉션으로 매핑)
 */
export interface Project extends BaseEntity {
  name: string;
  boothConfig: BoothConfig;
  layouts: Layout[];
}

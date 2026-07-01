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

/**
 * 행사장(부스) 기본 정보.
 * 3단계 "행사장 생성"에서 실제로 채워지고 저장됩니다.
 * 지금(2단계)은 폼 UI 및 타입 골격 용도로만 사용합니다.
 */
export interface BoothConfig {
  widthMm: number; // 부스 가로(mm)
  depthMm: number; // 부스 세로(mm)
  heightMm: number; // 부스 높이(mm)
  openSide: OpenSide; // 오픈면
  floorType: FloorType; // 바닥 종류
  customFloorName?: string; // floorType === 'custom' 일 때 사용
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
  pathPoints?: PointMm[]; // customPath / semicircle 등 곡선 정의
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

/**
 * Layout = 하나의 배치안(버전). 예: v1, v2, "체험존 강조안"
 * placedFixtures 는 저장 시점의 캔버스 배치 스냅샷입니다.
 */
export interface Layout {
  id: string;
  name: string;
  placedFixtures: PlacedFixture[];
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

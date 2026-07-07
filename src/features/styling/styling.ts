import type {
  BoothStyling,
  EnvironmentId,
  FloorMaterialId,
  StylePresetId,
  WallMaterialId,
} from '../../types';

/**
 * --- Professional Styling System (v0.9.8) ---
 * 바닥/벽 재질, 3D 환경, 스타일 프리셋의 정의 테이블 + 해석 헬퍼.
 * 실제 3D Mesh/텍스처 없이 색/패턴/그라디언트로 "제안서 느낌"을 가볍게 표현합니다(확장 가능 구조).
 */

export interface FloorMaterialDef {
  id: FloorMaterialId;
  label: string;
  /** 대표 색(2D 바닥 + 3D 바닥 fill) */
  color: string;
  /** 체크 패턴(타일) 표시 여부 */
  checker: boolean;
}

export interface WallMaterialDef {
  id: WallMaterialId;
  label: string;
  color: string;
}

export interface EnvironmentDef {
  id: EnvironmentId;
  label: string;
  /** 3D 배경 그라디언트 상/하 색. transparent 면 배경 미채움 */
  bgTop: string;
  bgBottom: string;
  transparent?: boolean;
  /** 3D 배경 다크 톤 여부(집기명 대비 등 참고용) */
  dark?: boolean;
}

export const FLOOR_MATERIALS: FloorMaterialDef[] = [
  { id: 'concrete', label: '콘크리트', color: '#b8bcc0', checker: false },
  { id: 'wood', label: '우드', color: '#c9a36a', checker: false },
  { id: 'marble', label: '마블', color: '#eceef1', checker: false },
  { id: 'stone', label: '스톤', color: '#9aa0a6', checker: true },
  { id: 'pvc', label: 'PVC', color: '#d8dde2', checker: false },
  { id: 'carpet', label: '카펫', color: '#8a95a5', checker: false },
  { id: 'white', label: '화이트', color: '#f4f6f8', checker: false },
  { id: 'black', label: '블랙', color: '#2b2f36', checker: false },
  { id: 'checker', label: '체커', color: '#e2e8f0', checker: true },
];

export const WALL_MATERIALS: WallMaterialDef[] = [
  { id: 'paint', label: '페인트', color: '#e9edf2' },
  { id: 'wood', label: '우드', color: '#caa878' },
  { id: 'fabric', label: '패브릭', color: '#d7d2c8' },
  { id: 'curtain', label: '커튼', color: '#dfe3ea' },
  { id: 'stone', label: '스톤', color: '#aeb4ba' },
  { id: 'concrete', label: '콘크리트', color: '#c3ccd8' },
  { id: 'ledwall', label: 'LED 월', color: '#1f2a44' },
  { id: 'acrylic', label: '아크릴', color: '#e6f0f4' },
];

export const ENVIRONMENTS: EnvironmentDef[] = [
  { id: 'studioWhite', label: 'Studio White', bgTop: '#ffffff', bgBottom: '#eef1f5' },
  { id: 'studioGray', label: 'Studio Gray', bgTop: '#e6e9ee', bgBottom: '#cdd3db' },
  { id: 'studioBlack', label: 'Studio Black', bgTop: '#232a35', bgBottom: '#0b1018', dark: true },
  { id: 'mall', label: 'Mall', bgTop: '#f6f1ea', bgBottom: '#e6dccf' },
  { id: 'exhibition', label: 'Exhibition Hall', bgTop: '#eaeef4', bgBottom: '#d3dae4' },
  { id: 'transparent', label: 'Transparent', bgTop: '#ffffff', bgBottom: '#ffffff', transparent: true },
];

export interface StylePresetDef {
  id: StylePresetId;
  label: string;
  floorMaterial: FloorMaterialId;
  wallMaterial: WallMaterialId;
  environment: EnvironmentId;
}

export const STYLE_PRESETS: StylePresetDef[] = [
  { id: 'modern', label: 'Modern', floorMaterial: 'concrete', wallMaterial: 'paint', environment: 'studioGray' },
  { id: 'minimal', label: 'Minimal', floorMaterial: 'white', wallMaterial: 'paint', environment: 'studioWhite' },
  { id: 'luxury', label: 'Luxury', floorMaterial: 'marble', wallMaterial: 'stone', environment: 'studioBlack' },
  { id: 'natural', label: 'Natural', floorMaterial: 'wood', wallMaterial: 'wood', environment: 'mall' },
  { id: 'beauty', label: 'Beauty', floorMaterial: 'marble', wallMaterial: 'acrylic', environment: 'studioWhite' },
  { id: 'baby', label: 'Baby', floorMaterial: 'pvc', wallMaterial: 'fabric', environment: 'studioWhite' },
  { id: 'pharmacy', label: 'Pharmacy', floorMaterial: 'pvc', wallMaterial: 'paint', environment: 'exhibition' },
  { id: 'popup', label: 'Pop-up', floorMaterial: 'checker', wallMaterial: 'ledwall', environment: 'exhibition' },
];

// --- 기본값 & 해석 ---
export const DEFAULT_FLOOR_MATERIAL: FloorMaterialId = 'checker';
export const DEFAULT_WALL_MATERIAL: WallMaterialId = 'concrete';
export const DEFAULT_ENVIRONMENT: EnvironmentId = 'studioWhite';

const FLOOR_MAP = new Map(FLOOR_MATERIALS.map((m) => [m.id, m]));
const WALL_MAP = new Map(WALL_MATERIALS.map((m) => [m.id, m]));
const ENV_MAP = new Map(ENVIRONMENTS.map((e) => [e.id, e]));
const PRESET_MAP = new Map(STYLE_PRESETS.map((p) => [p.id, p]));

export function floorMaterialDef(id: FloorMaterialId | undefined): FloorMaterialDef {
  return FLOOR_MAP.get(id ?? DEFAULT_FLOOR_MATERIAL) ?? FLOOR_MAP.get(DEFAULT_FLOOR_MATERIAL)!;
}
export function wallMaterialDef(id: WallMaterialId | undefined): WallMaterialDef {
  return WALL_MAP.get(id ?? DEFAULT_WALL_MATERIAL) ?? WALL_MAP.get(DEFAULT_WALL_MATERIAL)!;
}
export function environmentDef(id: EnvironmentId | undefined): EnvironmentDef {
  return ENV_MAP.get(id ?? DEFAULT_ENVIRONMENT) ?? ENV_MAP.get(DEFAULT_ENVIRONMENT)!;
}
export function stylePresetDef(id: StylePresetId): StylePresetDef | undefined {
  return PRESET_MAP.get(id);
}

/** 프리셋 → boothConfig.styling 패치 */
export function stylingFromPreset(id: StylePresetId): BoothStyling {
  const p = stylePresetDef(id);
  if (!p) return {};
  return {
    floorMaterial: p.floorMaterial,
    wallMaterial: p.wallMaterial,
    environment: p.environment,
    stylePreset: id,
  };
}

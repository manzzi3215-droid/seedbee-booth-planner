import {
  DEFAULT_TEXTURE_TRANSFORM,
  type BoxFace,
  type DesignAsset,
  type FixtureDef,
  type PrintFaceSettings,
  type PrintSettings,
} from '../../types';
import { BOX_FACES } from '../design/mapping';

/** 집기 높이 미설정 시 사용할 기본 높이(mm) */
export const DEFAULT_PRINT_HEIGHT_MM = 1000;
/** 블리드 프리셋(mm) */
export const BLEED_PRESETS = [0, 3, 5, 10];

/** 면별 자동 출력 사이즈(mm) — 집기 바운딩 박스 기준.
 *  front/back = width × height, left/right = depth × height, top/bottom = width × depth */
export function autoFaceSizeMm(def: FixtureDef, face: BoxFace): { widthMm: number; heightMm: number } {
  const w = Math.max(1, Math.round(def.widthMm));
  const d = Math.max(1, Math.round(def.depthMm));
  const h = Math.max(1, Math.round(def.heightMm ?? DEFAULT_PRINT_HEIGHT_MM));
  switch (face) {
    case 'front':
    case 'back':
      return { widthMm: w, heightMm: h };
    case 'left':
    case 'right':
      return { widthMm: d, heightMm: h };
    case 'top':
    case 'bottom':
    default:
      return { widthMm: w, heightMm: d };
  }
}

/** 면별 기본 출력 설정 */
export function defaultFaceSettings(def: FixtureDef, face: BoxFace): PrintFaceSettings {
  const size = autoFaceSizeMm(def, face);
  return {
    widthMm: size.widthMm,
    heightMm: size.heightMm,
    bleedMm: 3,
    safeAreaMm: 10,
    safeAreaOn: false,
    cropMark: true,
    transform: { ...DEFAULT_TEXTURE_TRANSFORM },
  };
}

/** 집기의 printSettings 를 항상 6면 채워진 형태로 보정(하위 호환: 없으면 기본값 생성) */
export function ensurePrintSettings(def: FixtureDef): PrintSettings {
  const faces: PrintSettings['faces'] = {};
  for (const f of BOX_FACES) {
    const existing = def.printSettings?.faces?.[f.value];
    faces[f.value] = existing
      ? { ...defaultFaceSettings(def, f.value), ...existing, transform: { ...DEFAULT_TEXTURE_TRANSFORM, ...existing.transform } }
      : defaultFaceSettings(def, f.value);
  }
  return { faces };
}

/** 블리드 포함 최종 출력 사이즈(mm) */
export function finalPrintSizeMm(face: PrintFaceSettings): { widthMm: number; heightMm: number } {
  return {
    widthMm: face.widthMm + face.bleedMm * 2,
    heightMm: face.heightMm + face.bleedMm * 2,
  };
}

export type DpiStatus = 'good' | 'warn' | 'low' | 'unknown';

export interface DpiResult {
  dpi: number | null;
  status: DpiStatus;
  label: string;
}

/**
 * 면 출력 사이즈 대비 원본 이미지 픽셀로 실효 DPI 계산.
 * 이미지가 면(블리드 포함)을 채우는 실제 크기(mm)를 기준으로 계산합니다.
 */
export function computeFaceDpi(
  asset: DesignAsset | null,
  face: PrintFaceSettings,
  mode: import('../../types').MappingMode,
): DpiResult {
  if (!asset || !asset.widthPx || !asset.heightPx) {
    return { dpi: null, status: 'unknown', label: '해상도 확인 불가' };
  }
  const bleedW = face.widthMm + face.bleedMm * 2;
  const bleedH = face.heightMm + face.bleedMm * 2;
  const scale = face.transform.scale || 1;
  // 이미지가 실제로 인쇄되는 크기(mm) — fit 방식 근사
  const ar = asset.widthPx / asset.heightPx;
  const far = bleedW / bleedH;
  let drawnW: number;
  let drawnH: number;
  if (mode === 'stretch') {
    drawnW = bleedW;
    drawnH = bleedH;
  } else if (mode === 'cover') {
    if (ar > far) {
      drawnH = bleedH;
      drawnW = bleedH * ar;
    } else {
      drawnW = bleedW;
      drawnH = bleedW / ar;
    }
  } else if (mode === 'tile') {
    drawnW = bleedW / 3;
    drawnH = drawnW / ar;
  } else {
    // contain / center
    if (ar > far) {
      drawnW = bleedW;
      drawnH = bleedW / ar;
    } else {
      drawnH = bleedH;
      drawnW = bleedH * ar;
    }
  }
  drawnW *= scale;
  drawnH *= scale;
  const dpiX = (asset.widthPx * 25.4) / Math.max(1, drawnW);
  const dpiY = (asset.heightPx * 25.4) / Math.max(1, drawnH);
  const dpi = Math.round(Math.min(dpiX, dpiY));
  return { dpi, ...dpiLabel(dpi) };
}

function dpiLabel(dpi: number): { status: DpiStatus; label: string } {
  if (dpi >= 300) return { status: 'good', label: `${dpi} dpi · 좋음` };
  if (dpi >= 150) return { status: 'warn', label: `${dpi} dpi · 주의` };
  return { status: 'low', label: `${dpi} dpi · 낮음` };
}

export interface ManifestFace {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  safeAreaMm: number;
  cropMark: boolean;
  dpi: number | null;
}

/** manifest.json 데이터 구성 */
export function buildManifest(
  projectName: string,
  fixtureName: string,
  settings: PrintSettings,
  dpiByFace: Partial<Record<BoxFace, number | null>>,
): {
  projectName: string;
  fixtureName: string;
  generatedAt: string;
  faces: Partial<Record<BoxFace, ManifestFace>>;
} {
  const faces: Partial<Record<BoxFace, ManifestFace>> = {};
  for (const f of BOX_FACES) {
    const s = settings.faces[f.value];
    if (!s) continue;
    faces[f.value] = {
      widthMm: s.widthMm,
      heightMm: s.heightMm,
      bleedMm: s.bleedMm,
      safeAreaMm: s.safeAreaOn ? s.safeAreaMm : 0,
      cropMark: s.cropMark,
      dpi: dpiByFace[f.value] ?? null,
    };
  }
  return {
    projectName,
    fixtureName,
    generatedAt: new Date().toISOString(),
    faces,
  };
}

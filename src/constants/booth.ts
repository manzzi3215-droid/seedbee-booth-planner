import type { OpenSide, FloorType, BoothConfig } from '../types';

/**
 * 행사장 생성 폼에서 사용하는 선택지 상수.
 * 여기 한 곳에서만 관리하면 폼/편집기 어디서든 재사용됩니다.
 */

export const OPEN_SIDE_OPTIONS: { value: OpenSide; label: string }[] = [
  { value: 1, label: '1면' },
  { value: 2, label: '2면' },
  { value: 3, label: '3면' },
];

export const FLOOR_TYPE_OPTIONS: { value: FloorType; label: string }[] = [
  { value: 'pytex', label: '파이텍스' },
  { value: 'decotile', label: '데코타일' },
  { value: 'basic', label: '기본' },
  { value: 'custom', label: '직접입력' },
];

/** 바닥 종류를 사람이 읽는 라벨로 변환 (custom 이면 직접입력한 이름) */
export function getFloorLabel(config: BoothConfig): string {
  if (config.floorType === 'custom') {
    return config.customFloorName?.trim() || '직접입력';
  }
  return FLOOR_TYPE_OPTIONS.find((o) => o.value === config.floorType)?.label ?? '-';
}

/** 부스 치수를 "W×D×H mm" 문자열로 */
export function getBoothSizeLabel(config: BoothConfig): string {
  return `${config.widthMm} × ${config.depthMm} × ${config.heightMm} mm`;
}

/**
 * 색상 시스템 (v0.8.5).
 * 기본/브랜드 팔레트, 최근 사용 색상(LocalStorage), HEX 검증/정규화, opacity→rgba 변환.
 */

export interface PaletteColor {
  name: string;
  hex: string;
}

/** 기본 팔레트 */
export const BASIC_COLORS: PaletteColor[] = [
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Black', hex: '#222222' },
  { name: 'Gray', hex: '#9E9E9E' },
  { name: 'Red', hex: '#E53935' },
  { name: 'Orange', hex: '#FB8C00' },
  { name: 'Yellow', hex: '#FDD835' },
  { name: 'Green', hex: '#43A047' },
  { name: 'Blue', hex: '#1E88E5' },
  { name: 'Purple', hex: '#8E24AA' },
  { name: 'Pink', hex: '#EC407A' },
];

/** 브랜드 컬러 (향후 추가 가능) */
export const BRAND_COLORS: PaletteColor[] = [
  { name: 'Seedbee Blue', hex: '#1E88E5' },
  { name: 'Seedbee Green', hex: '#2E7D32' },
  { name: 'Islo Mint', hex: '#CCF2FF' },
];

const RECENT_KEY = 'blp:recentColors';
const RECENT_MAX = 10;

/** HEX 형식(#RGB / #RRGGBB, # 생략 허용) 유효성 */
export function isValidHex(value: string): boolean {
  return /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim());
}

/** HEX 정규화: 대문자, # 자동 추가, 3자리→6자리. 실패 시 null */
export function normalizeHex(value: string): string | null {
  let s = value.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{3}$/.test(s)) s = s.split('').map((c) => c + c).join('');
  if (/^[0-9A-F]{6}$/.test(s)) return `#${s}`;
  return null;
}

/** HEX + opacity(0~1) → rgba() 문자열 */
export function hexToRgba(hex: string, opacity: number): string {
  const norm = normalizeHex(hex) ?? '#000000';
  const n = parseInt(norm.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const a = Math.max(0, Math.min(1, opacity));
  return `rgba(${r},${g},${b},${a})`;
}

/** 집기 fill 색: opacity 가 1 미만이면 rgba, 아니면 hex 그대로 (하위 호환) */
export function fillColor(color: string, opacity?: number): string {
  return opacity == null || opacity >= 1 ? color : hexToRgba(color, opacity);
}

/** 최근 사용 색상 목록 (LocalStorage) */
export function getRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(arr) ? arr.filter(isValidHex).map((c) => normalizeHex(c) ?? c) : [];
  } catch {
    return [];
  }
}

/** 최근 사용 색상에 추가 (맨 앞, 중복 제거, 최대 10개). 갱신된 목록 반환 */
export function addRecentColor(hex: string): string[] {
  const norm = normalizeHex(hex);
  if (!norm) return getRecentColors();
  const next = [norm, ...getRecentColors().filter((c) => c !== norm)].slice(0, RECENT_MAX);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

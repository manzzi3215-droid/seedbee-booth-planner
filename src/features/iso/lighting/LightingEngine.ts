import type { FixtureMaterial } from '../../../types';

/**
 * Lighting Engine (v0.9.2) — 확장형 조명 계산 엔진.
 *
 * 2D 아이소메트릭 투영 위에서 물리 근사(Lambert diffuse + ambient + spot) 조명을 계산합니다.
 * 각 면(face)의 3D 노멀과 위치, 재질을 받아 라이팅된 색을 돌려줍니다.
 *
 * 확장: 새 조명(LED/간접/쇼케이스/월워시 등)은 Light 유니온에 타입을 추가하고
 * accumulateLights() 에 case 한 개를 더하면 자동으로 반영됩니다.
 */

export type LightType = 'ambient' | 'directional' | 'spot' | 'area';

interface BaseLight {
  id: string;
  type: LightType;
  enabled: boolean;
  intensity: number; // 0..2
  color: string; // hex
}
export interface AmbientLight extends BaseLight {
  type: 'ambient';
}
export interface DirectionalLight extends BaseLight {
  type: 'directional';
  azimuthDeg: number; // 광원 방위각 (해가 있는 방향)
  elevationDeg: number; // 광원 고도 (0=지평선, 90=천정)
}
export interface SpotLight extends BaseLight {
  type: 'spot';
  xMm: number;
  yMm: number;
  zMm: number; // 조명 높이(mm)
  angleDeg: number; // 콘 각도(반각)
}
export interface AreaLight extends BaseLight {
  type: 'area';
  azimuthDeg: number;
  elevationDeg: number;
  softness: number; // 0..1 (넓은 확산광)
}
export type Light = AmbientLight | DirectionalLight | SpotLight | AreaLight;

export interface ShadowConfig {
  enabled: boolean;
  /** 0(선명) ~ 1(부드러움) */
  softness: number;
  /** 접지(Contact) 그림자 표시 */
  contact: boolean;
  /** 그림자 진하기 0..1 */
  opacity: number;
}

export interface LightingConfig {
  lights: Light[];
  /** 색온도(K) — 2700(따뜻)~6500(차가움) */
  colorTempK: number;
  shadow: ShadowConfig;
  /** 바닥 반사 강도 0..1 */
  groundReflection: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 태양 방향 프리셋 (azimuth/elevation °) */
export const SUN_PRESETS: { id: string; label: string; azimuthDeg: number; elevationDeg: number }[] = [
  { id: 'left', label: '좌측', azimuthDeg: 210, elevationDeg: 50 },
  { id: 'right', label: '우측', azimuthDeg: -30, elevationDeg: 50 },
  { id: 'front', label: '정면', azimuthDeg: 90, elevationDeg: 50 },
  { id: 'back', label: '후면', azimuthDeg: -90, elevationDeg: 55 },
  { id: 'top', label: '상단', azimuthDeg: 0, elevationDeg: 85 },
];

export const COLOR_TEMPS = [2700, 3000, 4000, 5000, 6500];

let uid = 0;
const nid = (p: string) => `${p}${uid++}`;

/** 기본 조명: Ambient + Directional (요구사항 기본값) */
export function defaultLighting(): LightingConfig {
  return {
    lights: [
      { id: nid('amb'), type: 'ambient', enabled: true, intensity: 0.55, color: '#ffffff' },
      {
        id: nid('dir'),
        type: 'directional',
        enabled: true,
        intensity: 0.95,
        color: '#ffffff',
        azimuthDeg: 210,
        elevationDeg: 52,
      },
      {
        id: nid('spot'),
        type: 'spot',
        enabled: false,
        intensity: 0.8,
        color: '#ffffff',
        xMm: 0,
        yMm: 0,
        zMm: 3500,
        angleDeg: 40,
      },
    ],
    colorTempK: 5000,
    shadow: { enabled: true, softness: 0.5, contact: true, opacity: 0.28 },
    groundReflection: 0.15,
  };
}

/** 방위각/고도(°) → 단위 벡터 (지면에서 광원을 향하는 방향) */
export function sunToLightDir(azimuthDeg: number, elevationDeg: number): Vec3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (elevationDeg * Math.PI) / 180;
  const ce = Math.cos(el);
  return { x: ce * Math.cos(az), y: ce * Math.sin(az), z: Math.sin(el) };
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): RGB {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 색온도(K) → RGB 배율(0..~1.3) — Tanner Helland 근사 */
export function colorTempTint(kelvin: number): RGB {
  const t = Math.max(1000, Math.min(40000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
  } else {
    r = 329.7 * Math.pow(t - 60, -0.1332);
    g = 288.12 * Math.pow(t - 60, -0.0755);
  }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.52 * Math.log(t - 10) - 305.04;
  const clamp = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** 한 면(노멀 n, 중심 center)에 도달하는 조명량(RGB 0..~2) 누적 */
export function accumulateLights(cfg: LightingConfig, n: Vec3, center: Vec3): RGB {
  const tint = colorTempTint(cfg.colorTempK);
  const acc: RGB = { r: 0, g: 0, b: 0 };
  const add = (color: string, amount: number) => {
    const c = hexToRgb(color);
    acc.r += (c.r / 255) * amount * tint.r;
    acc.g += (c.g / 255) * amount * tint.g;
    acc.b += (c.b / 255) * amount * tint.b;
  };
  const nn = norm(n);
  for (const light of cfg.lights) {
    if (!light.enabled || light.intensity <= 0) continue;
    switch (light.type) {
      case 'ambient':
        add(light.color, light.intensity);
        break;
      case 'directional': {
        const L = sunToLightDir(light.azimuthDeg, light.elevationDeg);
        const lambert = Math.max(0, dot(nn, L));
        add(light.color, light.intensity * lambert);
        break;
      }
      case 'area': {
        const L = sunToLightDir(light.azimuthDeg, light.elevationDeg);
        // 넓은 확산광: 반영을 부드럽게(반램버트)
        const half = (Math.max(0, dot(nn, L)) + 1 - light.softness) / (2 - light.softness);
        add(light.color, light.intensity * Math.max(0, half));
        break;
      }
      case 'spot': {
        const toLight = norm({ x: light.xMm - center.x, y: light.yMm - center.y, z: light.zMm - center.z });
        const lambert = Math.max(0, dot(nn, toLight));
        // 콘 감쇠: 스팟이 바로 아래(−z)를 향한다고 가정, 면과의 각도로 페이드
        const down = { x: 0, y: 0, z: -1 };
        const ang = Math.acos(Math.max(-1, Math.min(1, dot({ x: -toLight.x, y: -toLight.y, z: -toLight.z }, down))));
        const cone = Math.max(0, 1 - ang / ((light.angleDeg * Math.PI) / 180));
        add(light.color, light.intensity * lambert * cone);
        break;
      }
    }
  }
  return acc;
}

/** 면의 라이팅된 채움색 (재질 반영). 스페큘러/투명은 renderIso 가 추가 처리 */
export function shadeFace(
  cfg: LightingConfig,
  baseHex: string,
  normal: Vec3,
  center: Vec3,
): string {
  const base = hexToRgb(baseHex);
  const light = accumulateLights(cfg, normal, center);
  const ch = (b: number, l: number) => Math.round(Math.max(0, Math.min(255, (b / 255) * l * 255)));
  return `rgb(${ch(base.r, light.r)},${ch(base.g, light.g)},${ch(base.b, light.b)})`;
}

/** 재질별 파라미터 (스페큘러 세기, 투명도 배율, 반사) */
export function materialProps(material: FixtureMaterial | undefined): {
  specular: number;
  shininess: number;
  alphaMul: number;
  reflection: number;
} {
  switch (material) {
    case 'gloss':
      return { specular: 0.85, shininess: 48, alphaMul: 1, reflection: 0.35 };
    case 'semiGloss':
      return { specular: 0.45, shininess: 24, alphaMul: 1, reflection: 0.2 };
    case 'transparent':
      return { specular: 0.6, shininess: 40, alphaMul: 0.45, reflection: 0.15 };
    case 'acrylic':
      return { specular: 0.9, shininess: 60, alphaMul: 0.7, reflection: 0.3 };
    case 'matte':
    default:
      return { specular: 0.05, shininess: 8, alphaMul: 1, reflection: 0 };
  }
}

/** 주 directional 광원의 지면 그림자 오프셋 벡터(mm/height) — cast shadow 용 */
export function primaryShadowOffset(cfg: LightingConfig): { dx: number; dy: number } | null {
  const dir = cfg.lights.find((l): l is DirectionalLight => l.type === 'directional' && l.enabled);
  if (!dir) return null;
  const el = Math.max(8, dir.elevationDeg);
  const cot = 1 / Math.tan((el * Math.PI) / 180);
  const az = (dir.azimuthDeg * Math.PI) / 180;
  // 그림자는 광원 반대 방향으로 h*cot(el) 만큼
  return { dx: -Math.cos(az) * cot, dy: -Math.sin(az) * cot };
}

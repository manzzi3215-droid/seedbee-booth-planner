import type { BoxFace, PlacedDimension, PlacedText } from '../../types';
import { dimensionDisplayLabel } from '../dimensions/constants';
import { TEXT_FONT_FAMILY } from '../texts/constants';
import type { IsoScene, IsoWall, V3 } from './scene';
import {
  type LightingConfig,
  type Vec3,
  defaultLighting,
  shadeFace,
  materialProps,
  primaryShadowOffset,
  sunToLightDir,
} from './lighting/LightingEngine';

/**
 * 아이소메트릭 2D 렌더러 (preview 전용, 편집 없음).
 * 3D 씬(mm)을 선택 시점으로 투영해 2D 캔버스에 그린 뒤 PNG dataURL 을 반환합니다.
 * 시점/그림자/벽 투명도/바닥/집기명 등은 옵션으로 제어합니다.
 * (투영식만 바꾸면 추후 Three.js 로 교체 가능한 구조)
 */

export type IsoViewpointId =
  | 'leftDiagonal'
  | 'rightDiagonal'
  | 'frontDiagonal'
  | 'backDiagonal'
  | 'top';

/** 시점 프리셋 — 방위각(°)/고도(°) 로 자유 궤도(orbit) 카메라와 통일 (v0.9.1) */
export const VIEWPOINTS: { id: IsoViewpointId; label: string; azimuthDeg: number; elevationDeg: number }[] = [
  { id: 'frontDiagonal', label: '정면 사선', azimuthDeg: 14, elevationDeg: 28 },
  { id: 'leftDiagonal', label: '좌측 사선', azimuthDeg: -48, elevationDeg: 28 },
  { id: 'rightDiagonal', label: '우측 사선', azimuthDeg: 48, elevationDeg: 28 },
  { id: 'backDiagonal', label: '후면 사선', azimuthDeg: -132, elevationDeg: 28 },
  { id: 'top', label: 'Top View', azimuthDeg: 0, elevationDeg: 90 },
];

export interface IsoRenderOptions {
  viewpoint: IsoViewpointId;
  /** 시점을 향한(근접) 벽의 반투명도 0..1 */
  wallOpacity: number;
  /** 바닥 색 */
  floorColor: string;
  /** 바닥 체크 패턴 표시 */
  floorChecker: boolean;
  /** 집기명 3D 표시 */
  showNames: boolean;
  /** 그림자 표시 */
  showShadows: boolean;
  /** 사이즈(치수) 표기 — 부스 전체 + 주요 집기 치수 (실무시안, v1.0.8) */
  showDimensions?: boolean;
  /** 출력 긴 변 px */
  targetPx: number;
  /** 배경 테마 (기본 light). Presentation Dark 모드에서 dark (v0.8.8) */
  background?: 'light' | 'dark';
  /** 벽 재질 색 (v0.9.8). 미지정 시 기본 콘크리트 톤 */
  wallColor?: string;
  /** 3D 환경 배경 그라디언트 상/하 색 (v0.9.8). 지정 시 background 대신 사용 */
  envBgTop?: string;
  envBgBottom?: string;
  /** 배경 투명(Presentation Quality, v0.9.8) — PNG 저장 시 배경 제거 */
  transparentBg?: boolean;
  /** 자유 궤도 카메라 방위각(°). 지정 시 viewpoint 대신 사용 (v0.9.1) */
  azimuthDeg?: number;
  /** 자유 궤도 카메라 고도(°) 20~90. 지정 시 viewpoint 대신 사용 (v0.9.1) */
  elevationDeg?: number;
  /** 이미지 패닝(px) — 자유 카메라 (v0.9.1) */
  panX?: number;
  panY?: number;
  /** 조명 설정 (v0.9.2). 미지정 시 기본 조명(Ambient+Directional) */
  lighting?: LightingConfig;
}

export const DEFAULT_ISO_OPTIONS: IsoRenderOptions = {
  viewpoint: 'rightDiagonal',
  wallOpacity: 0.32,
  floorColor: '#e2e8f0',
  floorChecker: true,
  showNames: true,
  showShadows: true,
  targetPx: 1400,
};

interface Pt {
  x: number;
  y: number;
}

interface ViewParams {
  az: number; // 지면 회전(방위각, rad)
  kDepth: number; // 깊이축(v) 수직 압축
  kZ: number; // 높이(z) 반영 정도 (Top=0)
  top: boolean;
}

const D = Math.PI / 180;

/** footprint edge index → 집기 면 (getFixtureCorners 순서 기준) */
const SIDE_FACE_ORDER: BoxFace[] = ['back', 'right', 'front', 'left'];

function viewParams(vp: IsoViewpointId): ViewParams {
  const preset = VIEWPOINTS.find((v) => v.id === vp) ?? VIEWPOINTS[0];
  return orbitParams(preset.azimuthDeg, preset.elevationDeg);
}

/** 방위각/고도(°) → 투영 파라미터 (자유 궤도 카메라, v0.9.1) */
function orbitParams(azimuthDeg: number, elevationDeg: number): ViewParams {
  const e = Math.max(20, Math.min(90, elevationDeg));
  const u = Math.max(0, Math.min(1, (e - 25) / 65)); // 0 @25° .. 1 @90°(top)
  return {
    az: azimuthDeg * D,
    kDepth: 0.5 + 0.5 * u,
    kZ: 1 - u,
    top: e >= 88,
  };
}

/** hex 색을 factor 로 밝기 조절 → rgb() */
function shade(hex: string, factor: number): string {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const n = parseInt(full, 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return `rgb(${r},${g},${b})`;
}

/** 지면 XY 볼록껍질 (그림자 스윕용) */
function convexHull(pts: Pt[]): Pt[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

interface DrawUnit {
  depth: number;
  draw: () => void;
}

export function renderIsoSceneToDataURL(
  scene: IsoScene,
  imageElements: Map<string, HTMLImageElement>,
  options: IsoRenderOptions,
): string {
  // 자유 궤도 카메라(azimuth/elevation) 우선, 없으면 viewpoint 프리셋
  const vp =
    options.azimuthDeg != null && options.elevationDeg != null
      ? orbitParams(options.azimuthDeg, options.elevationDeg)
      : viewParams(options.viewpoint);
  const ca = Math.cos(vp.az);
  const sa = Math.sin(vp.az);
  const panX = options.panX ?? 0;
  const panY = options.panY ?? 0;

  // --- 조명 (v0.9.2) ---
  const lighting = options.lighting ?? defaultLighting();
  const n3 = (v: Vec3): Vec3 => {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  };
  const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
  // 뷰어를 향하는 근사 벡터(스페큘러용)
  const viewDir = n3({ x: -sa, y: -ca, z: 0.55 });
  // 주 directional 광원(스페큘러/하이라이트용)
  const primaryDir = lighting.lights.find((l) => l.type === 'directional' && l.enabled) as
    | { azimuthDeg: number; elevationDeg: number; intensity: number }
    | undefined;
  /** Blinn-Phong 근사 스페큘러 세기(0..1) */
  const specularAt = (normal: Vec3, mat: ReturnType<typeof materialProps>): number => {
    if (!primaryDir || mat.specular <= 0) return 0;
    const L = sunToLightDir(primaryDir.azimuthDeg, primaryDir.elevationDeg);
    const H = n3({ x: L.x + viewDir.x, y: L.y + viewDir.y, z: L.z + viewDir.z });
    const nh = Math.max(0, dot3(n3(normal), H));
    return Math.pow(nh, mat.shininess) * mat.specular * (primaryDir.intensity || 1);
  };

  const rawProj = (p: V3): Pt => ({
    x: p.x * ca - p.y * sa,
    y: (p.x * sa + p.y * ca) * vp.kDepth - p.z * vp.kZ,
  });
  const depthOf = (pts: V3[]): number => {
    let s = 0;
    for (const p of pts) s += p.x * sa + p.y * ca + p.z * 0.5;
    return s / (pts.length || 1);
  };

  // 1) 전체 점 수집 → 투영 → fit
  const allPts: V3[] = [...scene.floorPolygon];
  for (const w of scene.walls) {
    allPts.push(w.baseStart, w.baseEnd, { ...w.baseStart, z: w.heightMm }, { ...w.baseEnd, z: w.heightMm });
  }
  for (const box of scene.boxes) {
    for (const f of box.footprint) allPts.push(f, { ...f, z: (box.baseZmm ?? 0) + box.heightMm });
  }
  // 사람 실루엣 발/머리 지점도 fit 범위에 포함 (부스 바깥이라도 잘리지 않도록, v1.0.8)
  for (const h of scene.humans ?? []) {
    allPts.push({ x: h.x, y: h.y, z: 0 }, { x: h.x, y: h.y, z: h.heightMm });
  }
  const projected = allPts.map(rawProj);
  const minX = Math.min(...projected.map((p) => p.x));
  const maxX = Math.max(...projected.map((p) => p.x));
  const minY = Math.min(...projected.map((p) => p.y));
  const maxY = Math.max(...projected.map((p) => p.y));
  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;

  const MARGIN = Math.round(options.targetPx * 0.05);
  const TARGET = Math.max(200, options.targetPx - MARGIN * 2);
  const scale = TARGET / Math.max(contentW, contentH);
  const offX = MARGIN - minX * scale;
  const offY = MARGIN - minY * scale;

  const P = (p: V3): Pt => {
    const r = rawProj(p);
    return { x: r.x * scale + offX + panX, y: r.y * scale + offY + panY };
  };

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(contentW * scale + MARGIN * 2);
  canvas.height = Math.ceil(contentH * scale + MARGIN * 2);
  const ctx = canvas.getContext('2d')!;
  // 텍스처 필터링/안티에일리어싱 품질 향상 (v0.9.1)
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const reset = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
  };

  /** 면 텍스처(디자인 매핑 base/overlay) 한 장 그리기 — scale/offset(레이어 배치) + flipH 적용 (v1.0.6) */
  const drawFaceTex = (tex: import('./scene').IsoFaceTexture, sp00: Pt, sp10: Pt, sp01: Pt) => {
    const el = imageElements.get(tex.url);
    if (!el) return;
    const [c00, c10, c01] = insetFaceCorners(sp00, sp10, sp01, tex.scale ?? 1, tex.offsetX ?? 0, tex.offsetY ?? 0);
    drawAffineImage(ctx, el, c00, c10, c01, el.naturalWidth || el.width, el.naturalHeight || el.height, tex.opacity, tex.flipH);
    reset();
  };

  // 배경 (부드러운 그라디언트). 환경(Environment) 색 우선 → Dark 테마 → 기본 라이트.
  // transparentBg 면 배경을 채우지 않음(Presentation Quality: 배경 투명 PNG, v0.9.8).
  if (!options.transparentBg) {
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (options.envBgTop && options.envBgBottom) {
      bg.addColorStop(0, options.envBgTop);
      bg.addColorStop(1, options.envBgBottom);
    } else if (options.background === 'dark') {
      bg.addColorStop(0, '#1e293b');
      bg.addColorStop(1, '#0b1220');
    } else {
      bg.addColorStop(0, '#fbfcfe');
      bg.addColorStop(1, '#e9edf3');
    }
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const polygon = (pts: V3[], fill: string, stroke?: string, alpha = 1) => {
    const sp = pts.map(P);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].x, sp[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  };

  // 바닥 폴리곤 클립 경로 만들기
  const clipFloor = () => {
    const sp = scene.floorPolygon.map(P);
    ctx.beginPath();
    ctx.moveTo(sp[0].x, sp[0].y);
    for (let i = 1; i < sp.length; i++) ctx.lineTo(sp[i].x, sp[i].y);
    ctx.closePath();
    ctx.clip();
  };

  // 바닥 바운즈 (ground)
  const gMinX = Math.min(...scene.floorPolygon.map((p) => p.x));
  const gMaxX = Math.max(...scene.floorPolygon.map((p) => p.x));
  const gMinY = Math.min(...scene.floorPolygon.map((p) => p.y));
  const gMaxY = Math.max(...scene.floorPolygon.map((p) => p.y));
  const cx = (gMinX + gMaxX) / 2;
  const cy = (gMinY + gMaxY) / 2;

  // 벽 outward normal (부스 중심 반대)
  const wallNormal = (w: IsoWall) => {
    const dx = w.baseEnd.x - w.baseStart.x;
    const dy = w.baseEnd.y - w.baseStart.y;
    let nx = dy;
    let ny = -dx;
    const mx = (w.baseStart.x + w.baseEnd.x) / 2 - cx;
    const my = (w.baseStart.y + w.baseEnd.y) / 2 - cy;
    if (nx * mx + ny * my < 0) {
      nx = -nx;
      ny = -ny;
    }
    const len = Math.hypot(nx, ny) || 1;
    return { nx: nx / len, ny: ny / len };
  };

  const units: DrawUnit[] = []; // 바닥/그림자/바닥이미지 (배경)
  const wallUnits: DrawUnit[] = []; // 벽 (항상 집기 뒤) — v0.9.1 z-order
  const boxUnits: DrawUnit[] = []; // 집기 (항상 벽 앞)

  // --- 바닥 + 체크 패턴 ---
  units.push({
    depth: -Infinity,
    draw: () => {
      const litFloor = shadeFace(lighting, options.floorColor, { x: 0, y: 0, z: 1 }, { x: cx, y: cy, z: 0 });
      polygon(scene.floorPolygon, litFloor, '#94a3b8');
      if (options.floorChecker) {
        ctx.save();
        clipFloor();
        const cell = 500;
        const dark = shade(options.floorColor, 0.86);
        const i0 = Math.floor(gMinX / cell);
        const i1 = Math.ceil(gMaxX / cell);
        const j0 = Math.floor(gMinY / cell);
        const j1 = Math.ceil(gMaxY / cell);
        for (let i = i0; i < i1; i++) {
          for (let j = j0; j < j1; j++) {
            if (((i + j) & 1) === 0) continue;
            const x = i * cell;
            const y = j * cell;
            const q = [
              P({ x, y, z: 0 }),
              P({ x: x + cell, y, z: 0 }),
              P({ x: x + cell, y: y + cell, z: 0 }),
              P({ x, y: y + cell, z: 0 }),
            ];
            ctx.beginPath();
            ctx.moveTo(q[0].x, q[0].y);
            for (let k = 1; k < 4; k++) ctx.lineTo(q[k].x, q[k].y);
            ctx.closePath();
            ctx.fillStyle = dark;
            ctx.fill();
          }
        }
        ctx.restore();
      }
      // Ground Reflection: 반사 재질 바닥 광택(부드러운 하이라이트) — v0.9.2
      if (lighting.groundReflection > 0) {
        ctx.save();
        clipFloor();
        const gc = P({ x: cx, y: cy, z: 0 });
        const rad = Math.max(canvas.width, canvas.height) * 0.6;
        const grad = ctx.createRadialGradient(gc.x, gc.y - rad * 0.15, rad * 0.05, gc.x, gc.y, rad);
        const a = Math.min(0.4, lighting.groundReflection * 0.5);
        grad.addColorStop(0, `rgba(255,255,255,${a.toFixed(3)})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
      }
    },
  });

  // --- 그림자 (바닥 바로 위) — Real floor shadow: 실제 집기 형태 투영 + Contact + Soft (v0.9.2) ---
  if (options.showShadows && lighting.shadow.enabled) {
    const sh = lighting.shadow;
    const off = primaryShadowOffset(lighting); // 광원 기준 지면 투영 방향(높이 1당 오프셋)
    const softBlur = Math.max(2, options.targetPx * 0.005 * (0.4 + sh.softness));
    const contactBlur = Math.max(1, options.targetPx * 0.0018);

    // 캐스트 그림자: 실제 footprint 를 광원 반대방향으로 높이만큼 스윕(형태 유지)
    const castPolys: Pt[][] = [];
    const contactPolys: Pt[][] = [];
    for (const box of scene.boxes) {
      contactPolys.push(box.footprint.map((f) => ({ x: f.x, y: f.y })));
      if (off) {
        const h = box.heightMm;
        const ground: Pt[] = [];
        for (const f of box.footprint) {
          ground.push({ x: f.x, y: f.y });
          ground.push({ x: f.x + off.dx * h, y: f.y + off.dy * h });
        }
        castPolys.push(convexHull(ground));
      }
    }
    if (off) {
      for (const w of scene.walls) {
        const h = w.heightMm;
        castPolys.push([
          { x: w.baseStart.x, y: w.baseStart.y },
          { x: w.baseEnd.x, y: w.baseEnd.y },
          { x: w.baseEnd.x + off.dx * h, y: w.baseEnd.y + off.dy * h },
          { x: w.baseStart.x + off.dx * h, y: w.baseStart.y + off.dy * h },
        ]);
      }
    }

    const fillPolys = (polys: Pt[][], color: string, blur: number) => {
      ctx.filter = `blur(${blur}px)`;
      ctx.fillStyle = color;
      for (const gp of polys) {
        if (gp.length < 3) continue;
        const sp = gp.map((g) => P({ x: g.x, y: g.y, z: 0 }));
        ctx.beginPath();
        ctx.moveTo(sp[0].x, sp[0].y);
        for (let k = 1; k < sp.length; k++) ctx.lineTo(sp[k].x, sp[k].y);
        ctx.closePath();
        ctx.fill();
      }
      ctx.filter = 'none';
    };

    units.push({
      depth: -Infinity + 1,
      draw: () => {
        ctx.save();
        clipFloor();
        // Soft cast shadow (넓고 옅게)
        fillPolys(castPolys, `rgba(15,23,42,${(sh.opacity * 0.65).toFixed(3)})`, softBlur);
        // Contact/Ambient shadow (집기 바로 아래, 좁고 진하게)
        if (sh.contact) {
          fillPolys(contactPolys, `rgba(15,23,42,${Math.min(0.5, sh.opacity * 1.25).toFixed(3)})`, contactBlur);
        }
        ctx.restore();
      },
    });
  }

  // --- 바닥 이미지 ---
  for (const fi of scene.floorImages) {
    const img = fi.image;
    const el = imageElements.get(img.srcDataUrl);
    const p00: V3 = { x: img.xMm, y: img.yMm, z: 0 };
    const p10: V3 = { x: img.xMm + img.widthMm, y: img.yMm, z: 0 };
    const p01: V3 = { x: img.xMm, y: img.yMm + img.heightMm, z: 0 };
    units.push({
      depth: depthOf([p00, p10, p01]) + 1,
      draw: () => {
        if (!el) return;
        drawAffineImage(ctx, el, P(p00), P(p10), P(p01), img.widthMm, img.heightMm, img.opacity);
        reset();
      },
    });
  }

  // --- 벽 (평면 + 벽 요소) ---
  for (const w of scene.walls) {
    if (w.heightMm <= 0) continue;
    const topStart: V3 = { ...w.baseStart, z: w.heightMm };
    const topEnd: V3 = { ...w.baseEnd, z: w.heightMm };
    const quad = [w.baseStart, w.baseEnd, topEnd, topStart];
    const { nx, ny } = wallNormal(w);
    const facing = nx * sa + ny * ca; // >0 : 시점을 향한 근접 벽
    const alpha = facing > 0 ? options.wallOpacity : 0.96;
    const wallCenter: Vec3 = {
      x: (w.baseStart.x + w.baseEnd.x) / 2,
      y: (w.baseStart.y + w.baseEnd.y) / 2,
      z: w.heightMm / 2,
    };
    const wallFill = shadeFace(lighting, options.wallColor ?? '#c3ccd8', { x: nx, y: ny, z: 0 }, wallCenter);
    wallUnits.push({
      depth: depthOf(quad),
      draw: () => {
        polygon(quad, wallFill, 'rgba(100,116,139,0.7)', alpha);
        drawWallItems(ctx, w, imageElements, P, reset);
      },
    });
  }

  // --- 집기 박스 ---
  const nameDraws: { screen: Pt; depth: number; text: string }[] = [];
  const sizeDraws: { screen: Pt; depth: number; text: string }[] = [];
  for (const box of scene.boxes) {
    const fp = box.footprint;
    const topZ = (box.baseZmm ?? 0) + box.heightMm; // 상판 위 제품은 baseZ 만큼 올라감 (v0.9.4)
    const midZ = (box.baseZmm ?? 0) + box.heightMm / 2;
    const top = fp.map((f) => ({ ...f, z: topZ }));
    const bcx = fp.reduce((s, p) => s + p.x, 0) / fp.length;
    const bcy = fp.reduce((s, p) => s + p.y, 0) / fp.length;
    const boxDepth = depthOf([...fp, ...top]);
    const mat = materialProps(box.material);
    const boxAlpha = box.opacity * mat.alphaMul;
    boxUnits.push({
      depth: boxDepth,
      draw: () => {
        if (!vp.top) {
          // 곡면 wrap 용 둘레 누적 길이 (Cylinder/Rounded/Path UV)
          const wrapEl = box.curved && box.wrapTexture ? imageElements.get(box.wrapTexture.url) : undefined;
          let perim = 0;
          const cum: number[] = [];
          if (wrapEl) {
            for (let i = 0; i < fp.length; i++) {
              cum.push(perim);
              const nx2 = fp[(i + 1) % fp.length].x - fp[i].x;
              const ny2 = fp[(i + 1) % fp.length].y - fp[i].y;
              perim += Math.hypot(nx2, ny2);
            }
          }
          // 측면(뷰어를 향한 면만)
          for (let i = 0; i < fp.length; i++) {
            const a = fp[i];
            const bb = fp[(i + 1) % fp.length];
            const dx = bb.x - a.x;
            const dy = bb.y - a.y;
            let nx = dy;
            let ny = -dx;
            const mx = (a.x + bb.x) / 2 - bcx;
            const my = (a.y + bb.y) / 2 - bcy;
            if (nx * mx + ny * my < 0) {
              nx = -nx;
              ny = -ny;
            }
            if (nx * sa + ny * ca > 0) {
              const nlen = Math.hypot(nx, ny) || 1;
              const sideNormal: Vec3 = { x: nx / nlen, y: ny / nlen, z: 0 };
              const face = [a, bb, { ...bb, z: topZ }, { ...a, z: topZ }];
              polygon(face, shadeFace(lighting, box.color, sideNormal, { x: (a.x + bb.x) / 2, y: (a.y + bb.y) / 2, z: midZ }), 'rgba(0,0,0,0.32)', boxAlpha);
              const spec = specularAt(sideNormal, mat);
              if (spec > 0.02) polygon(face, '#ffffff', undefined, Math.min(0.55, spec) * boxAlpha);
              const topA: V3 = { ...a, z: topZ };
              const topB: V3 = { ...bb, z: topZ };
              if (wrapEl && box.wrapTexture && perim > 0) {
                // 곡면: 이미지를 둘레 비율로 잘라 각 facet 에 감쌈 (Cylinder/곡면 UV wrap)
                const iw = wrapEl.naturalWidth || wrapEl.width;
                const ih = wrapEl.naturalHeight || wrapEl.height;
                const u0 = cum[i] / perim;
                const u1 = (cum[i] + Math.hypot(dx, dy)) / perim;
                drawAffineImageRegion(ctx, wrapEl, u0 * iw, 0, Math.max(1, (u1 - u0) * iw), ih, P(topA), P(topB), P(a), box.wrapTexture.opacity);
                reset();
              } else if (fp.length === 4) {
                // 사각형(4면): base 매핑 + 추가 레이어(overlays) 순서대로 (v1.0.6)
                const sideKey = SIDE_FACE_ORDER[i % 4];
                if (box.faces?.[sideKey]) drawFaceTex(box.faces[sideKey]!, P(topA), P(topB), P(a));
                for (const ov of box.faceOverlays?.[sideKey] ?? []) drawFaceTex(ov, P(topA), P(topB), P(a));
              }
            }
          }
        }
        // 윗면
        const topNormal: Vec3 = { x: 0, y: 0, z: 1 };
        polygon(top, shadeFace(lighting, box.color, topNormal, { x: bcx, y: bcy, z: topZ }), 'rgba(0,0,0,0.3)', boxAlpha);
        const topSpec = specularAt(topNormal, mat);
        if (topSpec > 0.02) polygon(top, '#ffffff', undefined, Math.min(0.55, topSpec) * boxAlpha);
        // 윗면 텍스처: base + 추가 레이어(overlays) (v1.0.6)
        // 곡면/customPath 는 footprint 점이 많아 top[0/1/3] 이 부정확 → topFrame(방향성 사각형)으로 매핑 (v1.0.7)
        const topTexs = [box.faces?.top, ...(box.faceOverlays?.top ?? [])].filter((t): t is import('./scene').IsoFaceTexture => !!t);
        if (topTexs.length) {
          const tf = box.topFrame;
          const [ts00, ts10, ts01] = tf
            ? [P({ ...tf[0], z: topZ }), P({ ...tf[1], z: topZ }), P({ ...tf[3], z: topZ })]
            : [P(top[0]), P(top[1]), P(top[3])];
          // 윗면 폴리곤으로 클립(곡면 상단에서 이미지가 외곽을 넘지 않도록)
          ctx.save();
          const sp = top.map(P);
          ctx.beginPath();
          ctx.moveTo(sp[0].x, sp[0].y);
          for (let k = 1; k < sp.length; k++) ctx.lineTo(sp[k].x, sp[k].y);
          ctx.closePath();
          ctx.clip();
          for (const t of topTexs) drawFaceTex(t, ts00, ts10, ts01);
          ctx.restore();
          reset();
        }
      },
    });
    if (options.showNames) {
      const anchor: V3 = vp.top
        ? { x: bcx, y: bcy, z: (box.baseZmm ?? 0) }
        : { x: bcx, y: bcy, z: topZ };
      nameDraws.push({ screen: P(anchor), depth: boxDepth, text: box.name });
    }
    // 집기 치수 표기 (실무시안, v1.0.8) — 실제 집기(dims 있는 것)만
    if (options.showDimensions && box.dims) {
      sizeDraws.push({
        screen: P({ x: bcx, y: bcy, z: box.baseZmm ?? 0 }),
        depth: boxDepth,
        text: `${box.dims.wMm}×${box.dims.dMm}`,
      });
    }
  }

  // --- 사람 실루엣 (스케일 참고, v1.0.8) — 박스와 함께 깊이 정렬 ---
  for (const h of scene.humans ?? []) {
    const base: V3 = { x: h.x, y: h.y, z: 0 };
    const head: V3 = { x: h.x, y: h.y, z: h.heightMm };
    boxUnits.push({
      depth: depthOf([base, head]),
      draw: () => drawHuman(ctx, P(base), P(head)),
    });
  }

  // z-order: 배경(바닥/그림자) → 벽(항상 뒤) → 집기(항상 앞). 각 그룹 내부는 깊이순.
  units.sort((a, b) => a.depth - b.depth);
  wallUnits.sort((a, b) => a.depth - b.depth);
  boxUnits.sort((a, b) => a.depth - b.depth);
  for (const u of units) u.draw();
  for (const u of wallUnits) u.draw();
  for (const u of boxUnits) u.draw();
  reset();

  // --- 집기명 (최상단, 깊이순) ---
  if (options.showNames) {
    const fontPx = Math.max(11, options.targetPx / 78);
    nameDraws.sort((a, b) => a.depth - b.depth);
    for (const n of nameDraws) drawName(ctx, n.screen, n.text, fontPx);
  }

  // --- 사이즈(치수) 표기 (실무시안, v1.0.8) — 부스 전체 + 주요 집기 ---
  if (options.showDimensions) {
    const fontPx = Math.max(10, options.targetPx / 92);
    // 집기 치수 (집기명 아래쪽에 살짝 내려서)
    sizeDraws.sort((a, b) => a.depth - b.depth);
    const yOff = options.showNames ? fontPx * 1.7 : 0;
    for (const s of sizeDraws) {
      drawSizeLabel(ctx, { x: s.screen.x, y: s.screen.y + yOff }, s.text, fontPx);
    }
    // 부스 전체 치수 (앞쪽 바닥 중앙, 강조)
    const boothW = Math.round(gMaxX - gMinX);
    const boothD = Math.round(gMaxY - gMinY);
    const boothH = Math.round(Math.max(0, ...scene.walls.map((w) => w.heightMm)));
    const boothText = boothH > 0 ? `부스 ${boothW}×${boothD}×${boothH}mm` : `부스 ${boothW}×${boothD}mm`;
    const boothAnchor = P({ x: cx, y: gMaxY, z: 0 });
    drawSizeLabel(ctx, { x: boothAnchor.x, y: boothAnchor.y + fontPx * 1.6 }, boothText, fontPx * 1.15, true);
  }

  return canvas.toDataURL('image/png');
}

/** 사이즈(치수) 라벨 (v1.0.8) — 파란 배경 + 흰 글자. emphasize 면 강조 스타일. */
function drawSizeLabel(ctx: CanvasRenderingContext2D, at: Pt, text: string, fontPx: number, emphasize = false) {
  if (!text) return;
  ctx.save();
  ctx.font = `bold ${fontPx}px ${TEXT_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  const padX = fontPx * 0.5;
  const h = fontPx * 1.5;
  const rx = at.x - w / 2 - padX;
  const ry = at.y - h / 2;
  const rw = w + padX * 2;
  const r = fontPx * 0.35;
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.arcTo(rx + rw, ry, rx + rw, ry + h, r);
  ctx.arcTo(rx + rw, ry + h, rx, ry + h, r);
  ctx.arcTo(rx, ry + h, rx, ry, r);
  ctx.arcTo(rx, ry, rx + rw, ry, r);
  ctx.closePath();
  ctx.fillStyle = emphasize ? 'rgba(37,99,235,0.95)' : 'rgba(30,41,59,0.86)';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, at.x, at.y);
  ctx.restore();
}

/**
 * 사람 실루엣 (v1.0.8) — 머리 원형 + 몸통. 발(base)→머리(top) 스크린 벡터를 따라 빌보드로 그림.
 * 원근 투영에 맞춰 높이/폭이 자연스럽게 조정됩니다.
 */
function drawHuman(ctx: CanvasRenderingContext2D, base: Pt, top: Pt) {
  const axX = top.x - base.x;
  const axY = top.y - base.y;
  const L = Math.hypot(axX, axY) || 1;
  const ux = axX / L; // 위(머리) 방향 단위벡터
  const uy = axY / L;
  const px = -uy; // 수평(어깨) 단위벡터
  const py = ux;
  const W = L * 0.34; // 전체 어깨 폭
  // 축 위 t(0=발, 1=머리) + 수평 오프셋 s(±) → 스크린 좌표
  const pt = (t: number, s: number): Pt => ({
    x: base.x + ux * L * t + px * s,
    y: base.y + uy * L * t + py * s,
  });
  ctx.save();
  ctx.fillStyle = 'rgba(71,85,105,0.9)';
  ctx.strokeStyle = 'rgba(30,41,59,0.55)';
  ctx.lineWidth = Math.max(1, L * 0.015);
  // 몸통(어깨→허리→발) 실루엣 폴리곤
  const shoulder = W * 0.5;
  const waist = W * 0.34;
  const foot = W * 0.28;
  ctx.beginPath();
  const p0 = pt(0.0, -foot);
  ctx.moveTo(p0.x, p0.y);
  for (const [t, s] of [
    [0.0, foot],
    [0.42, waist],
    [0.72, shoulder],
    [0.72, -shoulder],
    [0.42, -waist],
  ] as [number, number][]) {
    const q = pt(t, s);
    ctx.lineTo(q.x, q.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 머리(원형)
  const headC = pt(0.87, 0);
  const headR = W * 0.28;
  ctx.beginPath();
  ctx.arc(headC.x, headC.y, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawName(ctx: CanvasRenderingContext2D, at: Pt, text: string, fontPx: number) {
  if (!text) return;
  ctx.save();
  ctx.font = `bold ${fontPx}px ${TEXT_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  const padX = fontPx * 0.5;
  const h = fontPx * 1.5;
  const rx = at.x - w / 2 - padX;
  const ry = at.y - h / 2;
  const rw = w + padX * 2;
  const r = fontPx * 0.4;
  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.arcTo(rx + rw, ry, rx + rw, ry + h, r);
  ctx.arcTo(rx + rw, ry + h, rx, ry + h, r);
  ctx.arcTo(rx, ry + h, rx, ry, r);
  ctx.arcTo(rx, ry, rx + rw, ry, r);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,23,42,0.22)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.fillText(text, at.x, at.y);
  ctx.restore();
}

/** 면(sp00,sp10,sp01) 안에서 레이어 배치(scale/offset) 적용한 3점 반환 (v1.0.6). 기본값이면 면 전체. */
function insetFaceCorners(sp00: Pt, sp10: Pt, sp01: Pt, s: number, ox: number, oy: number): [Pt, Pt, Pt] {
  if (s === 1 && ox === 0 && oy === 0) return [sp00, sp10, sp01];
  const ux = sp10.x - sp00.x;
  const uy = sp10.y - sp00.y;
  const vx = sp01.x - sp00.x;
  const vy = sp01.y - sp00.y;
  const uc = 0.5 + ox * 0.5;
  const vc = 0.5 + oy * 0.5;
  const h = s / 2;
  const u0 = uc - h;
  const v0 = vc - h;
  const at = (fu: number, fv: number): Pt => ({ x: sp00.x + ux * fu + vx * fv, y: sp00.y + uy * fu + vy * fv });
  return [at(u0, v0), at(u0 + s, v0), at(u0, v0 + s)];
}

/** 소스 이미지 사각형을 (p00,p10,p01) 평행사변형에 어파인 매핑. flipH 면 좌우 반전(v1.0.4) */
function drawAffineImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sp00: Pt,
  sp10: Pt,
  sp01: Pt,
  localW: number,
  localH: number,
  opacity: number,
  flipH = false,
) {
  const a = (sp10.x - sp00.x) / localW;
  const b = (sp10.y - sp00.y) / localW;
  const c = (sp01.x - sp00.x) / localH;
  const d = (sp01.y - sp00.y) / localH;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.transform(a, b, c, d, sp00.x, sp00.y);
  if (flipH) {
    // 평행사변형 내에서 이미지를 좌우 반전
    ctx.translate(localW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, 0, 0, localW, localH);
  ctx.restore();
}

/** 소스 이미지의 부분 영역(sx,sy,sw,sh)을 평행사변형에 매핑 (곡면 둘레 UV wrap, v0.9.1) */
function drawAffineImageRegion(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  sp00: Pt,
  sp10: Pt,
  sp01: Pt,
  opacity: number,
) {
  const a = (sp10.x - sp00.x) / sw;
  const b = (sp10.y - sp00.y) / sw;
  const c = (sp01.x - sp00.x) / sh;
  const d = (sp01.y - sp00.y) / sh;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.transform(a, b, c, d, sp00.x, sp00.y);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  ctx.restore();
}

/** 벽 로컬(u,v: 위=0) → 3D */
function wallLocalToV3(w: IsoWall, u: number, v: number): V3 {
  const t = w.wallLengthMm > 0 ? u / w.wallLengthMm : 0;
  return {
    x: w.baseStart.x + (w.baseEnd.x - w.baseStart.x) * t,
    y: w.baseStart.y + (w.baseEnd.y - w.baseStart.y) * t,
    z: w.heightMm - v,
  };
}

/** 벽 요소(이미지/텍스트/치수선)를 벽 평면에 붙여 그림 */
function drawWallItems(
  ctx: CanvasRenderingContext2D,
  w: IsoWall,
  imageElements: Map<string, HTMLImageElement>,
  P: (p: V3) => Pt,
  reset: () => void,
) {
  const sp00 = P(wallLocalToV3(w, 0, 0)); // 좌상단
  const sp10 = P(wallLocalToV3(w, w.wallLengthMm, 0)); // 우상단
  const sp01 = P(wallLocalToV3(w, 0, w.heightMm)); // 좌하단
  const a = (sp10.x - sp00.x) / (w.wallLengthMm || 1);
  const b = (sp10.y - sp00.y) / (w.wallLengthMm || 1);
  const c = (sp01.x - sp00.x) / (w.heightMm || 1);
  const d = (sp01.y - sp00.y) / (w.heightMm || 1);
  const applyWall = () => ctx.transform(a, b, c, d, sp00.x, sp00.y);

  for (const img of w.images) {
    const el = imageElements.get(img.srcDataUrl);
    if (!el) continue;
    ctx.save();
    ctx.globalAlpha = img.opacity;
    applyWall();
    ctx.drawImage(el, img.xMm, img.yMm, img.widthMm, img.heightMm);
    ctx.restore();
    reset();
  }

  for (const t of w.texts) {
    drawWallText(ctx, t, applyWall, reset);
  }

  for (const dim of w.dimensions) {
    drawWallDimension(ctx, w, dim, P);
  }
}

function drawWallText(
  ctx: CanvasRenderingContext2D,
  t: PlacedText,
  applyWall: () => void,
  reset: () => void,
) {
  ctx.save();
  applyWall();
  const pad = Math.max(t.fontSizeMm * 0.15, 20);
  if (t.backgroundColor) {
    ctx.fillStyle = t.backgroundColor;
    ctx.fillRect(t.xMm, t.yMm, t.text.length * t.fontSizeMm * 0.62 + pad * 2, t.fontSizeMm + pad * 2);
  }
  ctx.fillStyle = t.color;
  ctx.font = `${t.bold ? 'bold ' : ''}${t.fontSizeMm}px ${TEXT_FONT_FAMILY}`;
  ctx.textBaseline = 'top';
  ctx.fillText(t.text || ' ', t.xMm + pad, t.yMm + pad);
  ctx.restore();
  reset();
}

function drawWallDimension(
  ctx: CanvasRenderingContext2D,
  w: IsoWall,
  dim: PlacedDimension,
  P: (p: V3) => Pt,
) {
  const s = P(wallLocalToV3(w, dim.startXMm, dim.startYMm));
  const e = P(wallLocalToV3(w, dim.endXMm, dim.endYMm));
  ctx.save();
  ctx.strokeStyle = dim.color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y);
  ctx.lineTo(e.x, e.y);
  ctx.stroke();
  ctx.fillStyle = dim.textColor;
  ctx.font = `13px ${TEXT_FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(dimensionDisplayLabel(dim), (s.x + e.x) / 2, (s.y + e.y) / 2 - 4);
  ctx.restore();
}

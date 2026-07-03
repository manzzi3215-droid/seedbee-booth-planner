import type { PlacedDimension, PlacedText } from '../../types';
import { dimensionDisplayLabel } from '../dimensions/constants';
import { TEXT_FONT_FAMILY } from '../texts/constants';
import type { IsoScene, IsoWall, V3 } from './scene';

/**
 * 아이소메트릭 2D 렌더러 (preview 전용, 편집 없음).
 * 3D 씬(mm)을 선택 시점으로 투영해 2D 캔버스에 그린 뒤 PNG dataURL 을 반환합니다.
 * 시점/그림자/벽 투명도/바닥/집기명 등은 옵션으로 제어합니다.
 * (투영식만 바꾸면 추후 Three.js 로 교체 가능한 구조)
 */

export type IsoViewpointId = 'leftDiagonal' | 'rightDiagonal' | 'frontDiagonal' | 'top';

export const VIEWPOINTS: { id: IsoViewpointId; label: string }[] = [
  { id: 'leftDiagonal', label: '좌측 사선' },
  { id: 'rightDiagonal', label: '우측 사선' },
  { id: 'frontDiagonal', label: '정면 사선' },
  { id: 'top', label: 'Top View' },
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
  /** 출력 긴 변 px */
  targetPx: number;
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

function viewParams(vp: IsoViewpointId): ViewParams {
  switch (vp) {
    case 'leftDiagonal':
      return { az: -48 * D, kDepth: 0.52, kZ: 1, top: false };
    case 'rightDiagonal':
      return { az: 48 * D, kDepth: 0.52, kZ: 1, top: false };
    case 'frontDiagonal':
      return { az: 14 * D, kDepth: 0.5, kZ: 1, top: false };
    case 'top':
      return { az: 0, kDepth: 1, kZ: 0, top: true };
  }
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
  const vp = viewParams(options.viewpoint);
  const ca = Math.cos(vp.az);
  const sa = Math.sin(vp.az);

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
    for (const f of box.footprint) allPts.push(f, { ...f, z: box.heightMm });
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
    return { x: r.x * scale + offX, y: r.y * scale + offY };
  };

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(contentW * scale + MARGIN * 2);
  canvas.height = Math.ceil(contentH * scale + MARGIN * 2);
  const ctx = canvas.getContext('2d')!;
  const reset = () => ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 배경 (부드러운 그라디언트)
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, '#fbfcfe');
  bg.addColorStop(1, '#e9edf3');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

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

  // 조명 방향(지면) — 좌상단 앞에서
  const Llen = Math.hypot(-0.42, -0.6);
  const Lx = -0.42 / Llen;
  const Ly = -0.6 / Llen;

  const units: DrawUnit[] = [];

  // --- 바닥 + 체크 패턴 ---
  units.push({
    depth: -Infinity,
    draw: () => {
      polygon(scene.floorPolygon, options.floorColor, '#94a3b8');
      if (options.floorChecker) {
        ctx.save();
        clipFloor();
        const cell = 500;
        const dark = shade(options.floorColor, 0.92);
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
    },
  });

  // --- 그림자 (바닥 바로 위) ---
  if (options.showShadows) {
    const blurPx = Math.max(3, options.targetPx * 0.006);
    const shadowPolys: Pt[][] = [];

    // 집기 그림자: footprint 를 빛 반대방향으로 높이만큼 스윕
    for (const box of scene.boxes) {
      const off = box.heightMm * 0.7;
      const ground: Pt[] = [];
      for (const f of box.footprint) {
        ground.push({ x: f.x, y: f.y });
        ground.push({ x: f.x - Lx * off, y: f.y - Ly * off });
      }
      shadowPolys.push(convexHull(ground));
    }
    // 벽 그림자: 벽 상단선을 지면에 투영
    for (const w of scene.walls) {
      const off = w.heightMm * 0.7;
      shadowPolys.push([
        { x: w.baseStart.x, y: w.baseStart.y },
        { x: w.baseEnd.x, y: w.baseEnd.y },
        { x: w.baseEnd.x - Lx * off, y: w.baseEnd.y - Ly * off },
        { x: w.baseStart.x - Lx * off, y: w.baseStart.y - Ly * off },
      ]);
    }

    units.push({
      depth: -Infinity + 1,
      draw: () => {
        ctx.save();
        clipFloor();
        ctx.filter = `blur(${blurPx}px)`;
        ctx.fillStyle = 'rgba(15,23,42,0.18)';
        for (const gp of shadowPolys) {
          if (gp.length < 3) continue;
          const sp = gp.map((g) => P({ x: g.x, y: g.y, z: 0 }));
          ctx.beginPath();
          ctx.moveTo(sp[0].x, sp[0].y);
          for (let k = 1; k < sp.length; k++) ctx.lineTo(sp[k].x, sp[k].y);
          ctx.closePath();
          ctx.fill();
        }
        ctx.filter = 'none';
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
    const dot = Math.max(-1, Math.min(1, nx * Lx + ny * Ly));
    const bright = 0.6 + 0.32 * dot; // 면별 명암 차이
    const alpha = facing > 0 ? options.wallOpacity : 0.96;
    units.push({
      depth: depthOf(quad),
      draw: () => {
        polygon(quad, shade('#c3ccd8', bright), 'rgba(100,116,139,0.7)', alpha);
        drawWallItems(ctx, w, imageElements, P, reset);
      },
    });
  }

  // --- 집기 박스 ---
  const nameDraws: { screen: Pt; depth: number; text: string }[] = [];
  for (const box of scene.boxes) {
    const fp = box.footprint;
    const top = fp.map((f) => ({ ...f, z: box.heightMm }));
    const bcx = fp.reduce((s, p) => s + p.x, 0) / fp.length;
    const bcy = fp.reduce((s, p) => s + p.y, 0) / fp.length;
    const boxDepth = depthOf([...fp, ...top]);
    units.push({
      depth: boxDepth,
      draw: () => {
        if (!vp.top) {
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
              const dot = Math.max(-1, Math.min(1, (nx / nlen) * Lx + (ny / nlen) * Ly));
              const face = [a, bb, { ...bb, z: box.heightMm }, { ...a, z: box.heightMm }];
              polygon(face, shade(box.color, 0.72 + 0.18 * dot), 'rgba(0,0,0,0.28)', box.opacity);
            }
          }
        }
        // 윗면
        polygon(top, shade(box.color, vp.top ? 1.0 : 1.1), 'rgba(0,0,0,0.28)', box.opacity);
      },
    });
    if (options.showNames) {
      const anchor: V3 = vp.top
        ? { x: bcx, y: bcy, z: 0 }
        : { x: bcx, y: bcy, z: box.heightMm };
      nameDraws.push({ screen: P(anchor), depth: boxDepth, text: box.name });
    }
  }

  units.sort((a, b) => a.depth - b.depth);
  for (const u of units) u.draw();
  reset();

  // --- 집기명 (최상단, 깊이순) ---
  if (options.showNames) {
    const fontPx = Math.max(11, options.targetPx / 78);
    nameDraws.sort((a, b) => a.depth - b.depth);
    for (const n of nameDraws) drawName(ctx, n.screen, n.text, fontPx);
  }

  return canvas.toDataURL('image/png');
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

/** 소스 이미지 사각형을 (p00,p10,p01) 평행사변형에 어파인 매핑 */
function drawAffineImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  sp00: Pt,
  sp10: Pt,
  sp01: Pt,
  localW: number,
  localH: number,
  opacity: number,
) {
  const a = (sp10.x - sp00.x) / localW;
  const b = (sp10.y - sp00.y) / localW;
  const c = (sp01.x - sp00.x) / localH;
  const d = (sp01.y - sp00.y) / localH;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.transform(a, b, c, d, sp00.x, sp00.y);
  ctx.drawImage(img, 0, 0, localW, localH);
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

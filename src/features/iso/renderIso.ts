import type { PlacedDimension, PlacedText } from '../../types';
import { dimensionDisplayLabel } from '../dimensions/constants';
import { TEXT_FONT_FAMILY } from '../texts/constants';
import type { IsoScene, IsoWall, V3 } from './scene';

/**
 * 아이소메트릭 2D 렌더러.
 * 3D 씬(mm)을 30° 아이소메트릭으로 투영해 2D 캔버스에 그린 뒤 PNG dataURL 반환.
 * (편집 없음 — preview 전용. 투영식만 바꾸면 추후 Three.js 로 교체 가능)
 */

const ISO = Math.PI / 6; // 30도
const COS = Math.cos(ISO);
const SIN = Math.sin(ISO);

interface Pt {
  x: number;
  y: number;
}

/** 3D → 화면(투영 원본, 스케일/오프셋 적용 전) */
function projectRaw(p: V3): Pt {
  return { x: (p.x - p.y) * COS, y: (p.x + p.y) * SIN - p.z };
}

/** 페인터 알고리즘 깊이 키 (작을수록 멀다=먼저 그림) */
function depthKey(pts: V3[]): number {
  let sx = 0, sy = 0, sz = 0;
  for (const p of pts) { sx += p.x; sy += p.y; sz += p.z; }
  const n = pts.length || 1;
  return sx / n + sy / n + (sz / n) * 0.5;
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

const MARGIN = 90;
const TARGET = 1500;

interface DrawUnit {
  depth: number;
  draw: () => void;
}

export function renderIsoSceneToDataURL(
  scene: IsoScene,
  imageElements: Map<string, HTMLImageElement>,
  pixelRatio = 2,
): string {
  // 1) 전체 점 수집 → 투영 → 바운딩 박스로 fit 계산
  const allPts: V3[] = [...scene.floorPolygon];
  for (const w of scene.walls) {
    allPts.push(w.baseStart, w.baseEnd, { ...w.baseStart, z: w.heightMm }, { ...w.baseEnd, z: w.heightMm });
  }
  for (const box of scene.boxes) {
    for (const f of box.footprint) {
      allPts.push(f, { ...f, z: box.heightMm });
    }
  }
  const projected = allPts.map(projectRaw);
  const minX = Math.min(...projected.map((p) => p.x));
  const maxX = Math.max(...projected.map((p) => p.x));
  const minY = Math.min(...projected.map((p) => p.y));
  const maxY = Math.max(...projected.map((p) => p.y));
  const contentW = maxX - minX || 1;
  const contentH = maxY - minY || 1;
  const scale = TARGET / Math.max(contentW, contentH);
  const offX = MARGIN - minX * scale;
  const offY = MARGIN - minY * scale;

  const P = (p: V3): Pt => {
    const r = projectRaw(p);
    return { x: r.x * scale + offX, y: r.y * scale + offY };
  };

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((contentW * scale + MARGIN * 2) * pixelRatio);
  canvas.height = Math.ceil((contentH * scale + MARGIN * 2) * pixelRatio);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(pixelRatio, pixelRatio);
  const reset = () => ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  ctx.fillStyle = '#ffffff';
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

  const units: DrawUnit[] = [];

  // --- 바닥 (가장 먼저) ---
  units.push({
    depth: -Infinity,
    draw: () => polygon(scene.floorPolygon, '#f1f5f9', '#94a3b8'),
  });

  // --- 바닥 이미지 ---
  for (const fi of scene.floorImages) {
    const img = fi.image;
    const el = imageElements.get(img.srcDataUrl);
    const p00: V3 = { x: img.xMm, y: img.yMm, z: 0 };
    const p10: V3 = { x: img.xMm + img.widthMm, y: img.yMm, z: 0 };
    const p01: V3 = { x: img.xMm, y: img.yMm + img.heightMm, z: 0 };
    units.push({
      depth: depthKey([p00, p10, p01]) + 1,
      draw: () => {
        if (!el) return;
        drawAffineImage(ctx, el, P(p00), P(p10), P(p01), img.widthMm, img.heightMm, img.opacity);
        reset();
      },
    });
  }

  // --- 벽 (평면 + 벽 요소) ---
  for (const w of scene.walls) {
    const topStart: V3 = { ...w.baseStart, z: w.heightMm };
    const topEnd: V3 = { ...w.baseEnd, z: w.heightMm };
    const quad = [w.baseStart, w.baseEnd, topEnd, topStart];
    const alpha = w.facingSum < 0 ? 0.42 : 0.16; // 뒷벽 진하게, 앞벽 연하게
    units.push({
      depth: depthKey(quad),
      draw: () => {
        polygon(quad, '#cbd5e1', '#94a3b8', alpha);
        drawWallItems(ctx, w, imageElements, P, reset);
      },
    });
  }

  // --- 집기 박스 ---
  for (const box of scene.boxes) {
    const fp = box.footprint;
    const top = fp.map((f) => ({ ...f, z: box.heightMm }));
    const cx = fp.reduce((s, p) => s + p.x, 0) / fp.length;
    const cy = fp.reduce((s, p) => s + p.y, 0) / fp.length;
    units.push({
      depth: depthKey([...fp, ...top]),
      draw: () => {
        // 측면(뷰어를 향한 면만)
        for (let i = 0; i < fp.length; i++) {
          const a = fp[i];
          const bb = fp[(i + 1) % fp.length];
          const dx = bb.x - a.x;
          const dy = bb.y - a.y;
          // 바깥 노멀 (박스 중심 반대쪽)
          let nx = dy, ny = -dx;
          const mx = (a.x + bb.x) / 2 - cx;
          const my = (a.y + bb.y) / 2 - cy;
          if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
          if (nx + ny > 0) {
            const face = [a, bb, { ...bb, z: box.heightMm }, { ...a, z: box.heightMm }];
            polygon(face, shade(box.color, 0.7), 'rgba(0,0,0,0.25)');
          }
        }
        // 윗면
        polygon(top, shade(box.color, 1.08), 'rgba(0,0,0,0.25)');
      },
    });
  }

  units.sort((a, b) => a.depth - b.depth);
  for (const u of units) u.draw();
  reset();

  return canvas.toDataURL('image/png');
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
  // 벽 로컬(u,v) → 화면 어파인
  const sp00 = P(wallLocalToV3(w, 0, 0)); // 좌상단
  const sp10 = P(wallLocalToV3(w, w.wallLengthMm, 0)); // 우상단
  const sp01 = P(wallLocalToV3(w, 0, w.heightMm)); // 좌하단
  const a = (sp10.x - sp00.x) / (w.wallLengthMm || 1);
  const b = (sp10.y - sp00.y) / (w.wallLengthMm || 1);
  const c = (sp01.x - sp00.x) / (w.heightMm || 1);
  const d = (sp01.y - sp00.y) / (w.heightMm || 1);
  const applyWall = () => ctx.transform(a, b, c, d, sp00.x, sp00.y);

  // 이미지
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

  // 텍스트
  for (const t of w.texts) {
    drawWallText(ctx, t, applyWall, reset);
  }

  // 치수선 (선 + 라벨) — 화면 좌표로 직접
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

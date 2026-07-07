import type { VmdBackground, VmdBoard, VmdElement, VmdElementType } from '../../types';
import { generateId } from '../../utils/id';

/**
 * --- VMD Board 모델 헬퍼 (v1.0.1) ---
 * 보드 사이즈 프리셋, 기본 템플릿, 요소/보드 팩토리 등 순수 계산.
 */

export const BOARD_SIZE_PRESETS: { label: string; widthMm: number; heightMm: number }[] = [
  { label: '600 × 300', widthMm: 600, heightMm: 300 },
  { label: '900 × 450', widthMm: 900, heightMm: 450 },
  { label: '1200 × 600', widthMm: 1200, heightMm: 600 },
];

export interface BoardTemplate {
  key: string;
  label: string;
  widthMm: number;
  heightMm: number;
  background: VmdBackground;
}

const solidBg = (color: string, extra?: Partial<VmdBackground>): VmdBackground => ({
  mode: 'solid',
  color,
  outline: true,
  outlineColor: '#cbd5e1',
  radiusMm: 8,
  shadow: true,
  ...extra,
});

export const BOARD_TEMPLATES: BoardTemplate[] = [
  { key: 'counter', label: '카운터 상판', widthMm: 1200, heightMm: 500, background: solidBg('#f1f5f9', { pedestal: true }) },
  { key: 'shelf1', label: '선반 1단', widthMm: 900, heightMm: 300, background: solidBg('#f8fafc') },
  { key: 'shelf2', label: '선반 2단', widthMm: 900, heightMm: 600, background: solidBg('#f8fafc') },
  { key: 'shelf3', label: '선반 3단', widthMm: 900, heightMm: 900, background: solidBg('#f8fafc') },
  { key: 'pop', label: 'POP 보드', widthMm: 600, heightMm: 800, background: solidBg('#ffffff', { radiusMm: 4 }) },
  { key: 'acrylic', label: '아크릴 받침대', widthMm: 400, heightMm: 250, background: solidBg('#eef6fb', { pedestal: true, radiusMm: 12 }) },
  { key: 'table', label: '테이블 상판', widthMm: 1200, heightMm: 600, background: solidBg('#efe7db', { pedestal: true }) },
  { key: 'free', label: '자유 보드', widthMm: 900, heightMm: 600, background: { mode: 'transparent', outline: true, outlineColor: '#cbd5e1', radiusMm: 6 } },
];

export function defaultBackground(): VmdBackground {
  return solidBg('#f1f5f9');
}

let boardSeq = 1;
export function createBoard(opts?: Partial<VmdBoard>): VmdBoard {
  const now = Date.now();
  return {
    id: generateId(),
    name: opts?.name ?? `VMD 보드 ${boardSeq++}`,
    widthMm: opts?.widthMm ?? 900,
    heightMm: opts?.heightMm ?? 450,
    background: opts?.background ?? defaultBackground(),
    elements: opts?.elements ?? [],
    memo: opts?.memo,
    createdAt: now,
    updatedAt: now,
    sourceFixtureName: opts?.sourceFixtureName,
  };
}

export function boardFromTemplate(t: BoardTemplate): VmdBoard {
  return createBoard({ name: t.label, widthMm: t.widthMm, heightMm: t.heightMm, background: { ...t.background } });
}

/** 요소 기본 이름 */
const TYPE_LABEL: Record<VmdElementType, string> = {
  product: '제품',
  image: '이미지',
  text: '텍스트',
  shape: '도형',
  line: '라인',
};

export function elementDefaultName(type: VmdElementType, hint?: string): string {
  return hint ?? TYPE_LABEL[type];
}

/** 보드 중앙 근처에 요소 배치용 기본 좌표 */
export function centerXY(board: VmdBoard, wMm: number, hMm: number): { xMm: number; yMm: number } {
  return { xMm: Math.round(board.widthMm / 2 - wMm / 2), yMm: Math.round(board.heightMm / 2 - hMm / 2) };
}

export function makeElement(type: VmdElementType, board: VmdBoard, patch: Partial<VmdElement> = {}): VmdElement {
  const base: VmdElement = {
    id: generateId(),
    type,
    name: elementDefaultName(type, patch.name),
    xMm: 0,
    yMm: 0,
    widthMm: 200,
    heightMm: 200,
    rotationDeg: 0,
    opacity: 1,
  };
  const el = { ...base, ...patch, type, name: patch.name ?? base.name };
  if (patch.xMm == null || patch.yMm == null) {
    const c = centerXY(board, el.widthMm, el.heightMm);
    el.xMm = patch.xMm ?? c.xMm;
    el.yMm = patch.yMm ?? c.yMm;
  }
  return el;
}

/** 제품 수량 집계 (§9) */
export function countProducts(
  elements: VmdElement[],
  productName: (id: string) => string,
): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const el of elements) {
    if (el.type === 'product' && el.productId) {
      const n = productName(el.productId);
      map.set(n, (map.get(n) ?? 0) + 1);
    }
  }
  const other = elements.filter((e) => e.type !== 'product' && !e.hidden);
  const rows = [...map.entries()].map(([name, count]) => ({ name, count }));
  const popCount = other.filter((e) => e.type === 'image').length;
  if (popCount > 0) rows.push({ name: 'POP/이미지', count: popCount });
  return rows;
}

import type { BoxFace, DesignAsset, DesignMapping, FaceMapping } from '../../types';

/** 집기 면 순서/라벨 */
export const BOX_FACES: { value: BoxFace; label: string }[] = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

export const MAPPING_MODES: { value: FaceMapping['mode']; label: string }[] = [
  { value: 'stretch', label: 'Stretch' },
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover' },
  { value: 'center', label: 'Center' },
  { value: 'tile', label: 'Tile' },
];

/**
 * 특정 면에 렌더할 레이어 스택(아래→위). (v1.0.9)
 *
 * 각 레이어(FaceMapping)는 optional `faces`(적용 면 목록)로 자기가 보일 면을 지정할 수 있습니다.
 *  - `faces` 지정: 그 면 목록에만 렌더 (레이어별 면 적용).
 *  - `faces` 미지정(기존 데이터): 자기 버킷 면에만. 단 design.applyAll(레거시) 이면 front 버킷은 모든 면에 렌더.
 * 버킷 순회 순서(front→…→bottom)로 안정적 z-order 를 만들어, 흰 배경(front 작성) 위에 면별 레이어가 겹칩니다.
 */
export function layersForFace(design: DesignMapping | undefined, face: BoxFace): FaceMapping[] {
  if (!design) return [];
  const out: FaceMapping[] = [];
  for (const fb of BOX_FACES) {
    const bucket = fb.value;
    const base = design.faces[bucket];
    const extra = design.overlays?.[bucket] ?? [];
    const stack = base ? [base, ...extra] : extra;
    for (const L of stack) {
      const applies = L.faces
        ? L.faces.includes(face)
        : bucket === face || (design.applyAll && bucket === 'front');
      if (applies) out.push(L);
    }
  }
  return out;
}

/** 특정 면의 대표(최상단) 매핑 한 장 — 단일 이미지 소비처(출력물/곡면 wrap)용 (v1.0.9) */
export function resolveFaceMapping(design: DesignMapping | undefined, face: BoxFace): FaceMapping | null {
  const layers = layersForFace(design, face);
  return layers.length > 0 ? layers[layers.length - 1] : null;
}

/** 평면도(위에서 내려다봄)용 매핑: 윗면(top)의 최상단 레이어 */
export function planFaceMapping(design: DesignMapping | undefined): FaceMapping | null {
  return resolveFaceMapping(design, 'top');
}

export function assetById(assets: DesignAsset[] | undefined, id: string): DesignAsset | null {
  return assets?.find((a) => a.id === id) ?? null;
}

/**
 * 한 면의 전체 레이어 스택(아래→위): [base(faces[face]), ...overlays[face]] (v1.0.6).
 * 기존 저장파일(overlays 없음)은 base 하나만 반환 → 하위 호환.
 */
export function faceLayers(design: DesignMapping | undefined, face: BoxFace): FaceMapping[] {
  if (!design) return [];
  const base = design.faces[face];
  const extra = design.overlays?.[face] ?? [];
  return base ? [base, ...extra] : [...extra];
}

/** 디자인이 하나라도 매핑되어 있는지 */
export function hasAnyMapping(design: DesignMapping | undefined): boolean {
  return !!design && Object.keys(design.faces).length > 0;
}

/**
 * 매핑 방식별로 이미지를 면(fw×fh)에 배치할 dest 사각형(중심 정렬 전) 계산.
 * transform.scale/offset 은 호출부에서 추가 적용.
 */
export function computeFitRect(
  iw: number,
  ih: number,
  fw: number,
  fh: number,
  mode: FaceMapping['mode'],
): { dw: number; dh: number } {
  if (iw <= 0 || ih <= 0) return { dw: fw, dh: fh };
  const ar = iw / ih;
  const far = fw / fh;
  switch (mode) {
    case 'stretch':
      return { dw: fw, dh: fh };
    case 'cover':
      return ar > far ? { dw: fh * ar, dh: fh } : { dw: fw, dh: fw / ar };
    case 'contain':
    case 'center':
    default:
      return ar > far ? { dw: fw, dh: fw / ar } : { dw: fh * ar, dh: fh };
  }
}

/** 집기별 사용 개수 집계 (assetId → count). PlacedFixture[] 기준 */
export function countAssetUsage(
  placed: { design?: DesignMapping }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const p of placed) {
    if (!p.design) continue;
    const ids = new Set<string>();
    for (const f of BOX_FACES) {
      const m = p.design.faces[f.value];
      if (m) ids.add(m.assetId);
      for (const ov of p.design.overlays?.[f.value] ?? []) ids.add(ov.assetId); // 추가 레이어(v1.0.6)
    }
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

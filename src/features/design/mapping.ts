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

/** 특정 면의 매핑을 해석 (applyAll 이면 front 를 사용) */
export function resolveFaceMapping(design: DesignMapping | undefined, face: BoxFace): FaceMapping | null {
  if (!design) return null;
  if (design.applyAll) return design.faces.front ?? firstFace(design) ?? null;
  return design.faces[face] ?? null;
}

function firstFace(design: DesignMapping): FaceMapping | null {
  for (const f of BOX_FACES) {
    const m = design.faces[f.value];
    if (m) return m;
  }
  return null;
}

/** 평면도(위에서 내려다봄)용 매핑: top 우선, 없으면 applyAll/첫 면 */
export function planFaceMapping(design: DesignMapping | undefined): FaceMapping | null {
  if (!design) return null;
  if (design.applyAll) return design.faces.front ?? firstFace(design);
  return design.faces.top ?? firstFace(design);
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

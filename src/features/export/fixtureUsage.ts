import type { FixtureDef, PlacedFixture } from '../../types';
import { getShapeLabel } from '../fixtures/shapes';

export interface FixtureUsageRow {
  fixtureDefId: string;
  name: string;
  shapeLabel: string;
  sizeLabel: string; // "가로×세로×높이 mm"
  quantity: number;
}

/**
 * 배치안에 사용된 집기를 fixtureDefId 기준으로 집계(수량 합산).
 * 라이브러리에서 삭제된 집기(def 없음)는 "(삭제된 집기)"로 표시합니다.
 */
export function computeFixtureUsage(
  placed: PlacedFixture[],
  fixturesById: Map<string, FixtureDef>,
): FixtureUsageRow[] {
  const counts = new Map<string, number>();
  for (const p of placed) {
    counts.set(p.fixtureDefId, (counts.get(p.fixtureDefId) ?? 0) + 1);
  }

  const rows: FixtureUsageRow[] = [];
  for (const [defId, quantity] of counts) {
    const def = fixturesById.get(defId);
    if (def) {
      rows.push({
        fixtureDefId: defId,
        name: def.name,
        shapeLabel: getShapeLabel(def.shape),
        sizeLabel: `${def.widthMm}×${def.depthMm}×${def.heightMm ?? '-'} mm`,
        quantity,
      });
    } else {
      rows.push({
        fixtureDefId: defId,
        name: '(삭제된 집기)',
        shapeLabel: '-',
        sizeLabel: '-',
        quantity,
      });
    }
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

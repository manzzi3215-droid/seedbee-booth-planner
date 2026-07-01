import type { FixtureShape } from '../../types';

/** 집기 형태 선택지 및 라벨 */
export const SHAPE_OPTIONS: { value: FixtureShape; label: string }[] = [
  { value: 'rectangle', label: '사각형' },
  { value: 'roundedRectangle', label: '둥근 사각형' },
  { value: 'circle', label: '원형' },
  { value: 'semicircle', label: '반원형' },
  { value: 'customPath', label: '커스텀 경로' },
];

export function getShapeLabel(shape: FixtureShape): string {
  return SHAPE_OPTIONS.find((o) => o.value === shape)?.label ?? shape;
}

/** 이번 단계에서 등록/편집은 되지만 캔버스 렌더링은 추후 지원인 형태 */
export const NOT_YET_RENDERED_SHAPES: FixtureShape[] = ['customPath'];

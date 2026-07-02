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

/** 캔버스 렌더링이 아직 실제 형태가 아닌(placeholder) 형태 */
export const NOT_YET_RENDERED_SHAPES: FixtureShape[] = ['semicircle'];

/**
 * customPath SVG path 기준 좌표 박스 크기.
 * path 는 0~100 좌표계로 작성하고, 렌더링 시 (widthMm/100, depthMm/100) 로 스케일한다.
 */
export const CUSTOM_PATH_VIEW = 100;

/**
 * 기본 제공 비정형 집기 프리셋.
 * path 는 100×100 박스를 채우도록 작성되어 있으며, 선택 시 폼에 path 와
 * 권장 가로/세로/이름이 채워진다.
 */
export interface CustomPathPreset {
  key: string;
  name: string;
  svgPath: string;
  widthMm: number;
  depthMm: number;
  heightMm: number;
  color: string;
}

export const CUSTOM_PATH_PRESETS: CustomPathPreset[] = [
  {
    key: 'heart1600',
    name: '하트1600 테이블',
    // 하트: 위쪽 두 볼록, 아래 뾰족
    svgPath:
      'M50,96 C18,70 2,52 2,30 C2,12 20,2 34,12 C42,18 47,26 50,34 C53,26 58,18 66,12 C80,2 98,12 98,30 C98,52 82,70 50,96 Z',
    widthMm: 1600,
    depthMm: 1450,
    heightMm: 750,
    color: '#ec407a',
  },
  {
    key: 'waterjoin',
    name: '물이음 테이블',
    // 두 개의 둥근 덩어리가 가운데서 잘록하게 이어지는 형태(땅콩/물방울 이음)
    svgPath:
      'M6,50 C6,24 34,18 47,34 C49,36 51,36 53,34 C66,18 94,24 94,50 C94,76 66,82 53,66 C51,64 49,64 47,66 C34,82 6,76 6,50 Z',
    widthMm: 1800,
    depthMm: 900,
    heightMm: 750,
    color: '#42a5f5',
  },
  {
    key: 'bean',
    name: '콩모양 테이블',
    // 콩(kidney): 한쪽이 오목하게 들어간 곡선형
    svgPath:
      'M74,10 C90,20 96,40 88,56 C81,70 62,70 58,80 C54,90 40,96 24,88 C8,80 2,58 12,44 C20,32 12,26 20,16 C30,4 58,0 74,10 Z',
    widthMm: 1500,
    depthMm: 850,
    heightMm: 750,
    color: '#26a69a',
  },
];

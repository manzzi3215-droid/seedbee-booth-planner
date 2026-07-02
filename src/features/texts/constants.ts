import type { TextAlign } from '../../types';

/** 새 텍스트 기본값 */
export const DEFAULT_TEXT_CONTENT = '텍스트';
export const DEFAULT_TEXT_FONT_MM = 300; // 도면 mm 기준 글자 크기
export const DEFAULT_TEXT_COLOR = '#111827';

/** 한글이 깨지지 않도록 한글 지원 폰트 스택 */
export const TEXT_FONT_FAMILY = 'Pretendard, system-ui, "Malgun Gothic", "Apple SD Gothic Neo", sans-serif';

export const TEXT_ALIGN_OPTIONS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: '왼쪽' },
  { value: 'center', label: '가운데' },
  { value: 'right', label: '오른쪽' },
];

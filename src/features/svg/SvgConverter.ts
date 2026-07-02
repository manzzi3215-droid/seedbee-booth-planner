import type { FixtureDef, PlacedImage, SvgDocument, SvgElement } from '../../types';

/**
 * SvgConverter — SvgElement/SvgDocument 를 앱 도메인 객체로 변환하는 역할.
 *
 * ⚠️ 이번 버전(v0.7.0)에서는 "읽기"까지만 구현합니다.
 * 아래 변환기들은 다음 버전(v0.7.1)에서 구현 예정이며,
 * 지금은 변환기 붙이기 쉬운 구조를 위해 시그니처만 분리해 둡니다.
 *
 *   SvgElement → Fixture(FixtureDef)
 *   SvgElement → CustomPath(FixtureDef.svgPath)
 *   SvgDocument → Background(PlacedImage)
 *
 * 절대 이 단계에서 SVG 를 집기로 자동 변환하지 않습니다.
 */

const NOT_YET = 'SVG 변환은 다음 버전(v0.7.1)에서 지원됩니다.';

/** (예정) 단일 SVG 도형 → 집기 정의 */
export function svgElementToFixtureDef(_doc: SvgDocument, _el: SvgElement): FixtureDef {
  void _doc;
  void _el;
  throw new Error(NOT_YET);
}

/** (예정) 단일 SVG path/도형 → customPath 집기 정의 */
export function svgElementToCustomPath(_doc: SvgDocument, _el: SvgElement): FixtureDef {
  void _doc;
  void _el;
  throw new Error(NOT_YET);
}

/** (예정) SVG 문서 전체 → 배경 이미지 */
export function svgDocumentToBackground(_doc: SvgDocument): PlacedImage {
  void _doc;
  throw new Error(NOT_YET);
}

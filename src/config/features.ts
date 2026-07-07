/**
 * Feature Flags (v1.0.0-pre).
 * 특정 기능의 UI 노출을 켜고 끄는 스위치. 코드/데이터 구조는 유지하고 UI 만 숨깁니다.
 * (기존 프로젝트 데이터에는 영향 없음 — 렌더/저장 로직은 그대로 동작)
 */

/** 에셋 라이브러리(Asset 탭·Asset Manager) UI 노출 여부. v1.0.0-pre 에서 사용성 개선 전까지 숨김. */
export const ENABLE_ASSET_LIBRARY = false;

/** 스타일/재질/환경(Style) 패널 UI 노출 여부. v0.9.9 부터 숨김(코드 유지). */
export const ENABLE_STYLE_PANEL = false;

-- ============================================================================
-- 002: user_libraries.seed_locked — 앱 기본 시드/top-up 차단 플래그 (클라우드 기준)
-- ----------------------------------------------------------------------------
-- 목적: 마이그레이션(Firebase→Supabase)으로 라이브러리를 이전한 사용자에게, 다른 기기·새 브라우저·
--       시크릿·데이터삭제·SEED_VERSION 증가 상황에서도 앱 기본 시드가 다시 추가되지 않도록
--       "seed_locked=true" 를 클라우드에 저장한다.
--
-- 안전 조건
--   * 재실행 가능(add column if not exists).
--   * 기존 user_libraries 데이터(fixtures/assets) 보존 — 이 SQL 은 데이터를 수정하지 않음.
--   * 기존 사용자는 기본값 false(기존 신규 사용자처럼 시드 허용).
--   * 테이블·기존 컬럼 재생성 없음. RLS 정책 변경 없음(컬럼 추가는 정책에 영향 없음).
--   * 특정 uid 를 임의 업데이트하지 않음. service_role 불필요(대시보드 postgres 롤로 1회 실행).
-- ============================================================================

-- ── 적용 전 확인(선택): 현재 컬럼 목록 ─────────────────────────────────────
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'user_libraries'
-- order by ordinal_position;

-- ── 컬럼 추가(재실행 가능) ─────────────────────────────────────────────────
alter table public.user_libraries
  add column if not exists seed_locked boolean not null default false;

comment on column public.user_libraries.seed_locked is
  'true 면 이 사용자의 클라우드 라이브러리를 원본으로 사용하고 앱 기본 시드/top-up 을 추가하지 않음(마이그레이션 완료 표시). 기본 false.';

-- ── 적용 후 확인(선택): 기존 행은 false 유지, 데이터 개수 불변 ─────────────
-- select user_id,
--        seed_locked,
--        jsonb_array_length(fixtures) as fixtures,
--        jsonb_array_length(assets)  as assets
-- from public.user_libraries;

-- ============================================================================
-- 롤백(필요 시 — 자동 실행 금지):
--   alter table public.user_libraries drop column if exists seed_locked;
-- ============================================================================

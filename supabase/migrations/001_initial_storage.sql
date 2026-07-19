-- ============================================================================
-- Booth Layout Planner — Supabase 초기 저장소 스키마 (001)
-- ----------------------------------------------------------------------------
-- 목적: Firebase Firestore 에 있던 프로젝트 저장/공유 기능을 Supabase(Postgres)로
--       단계적으로 이전하기 위한 최소 스키마.
--
-- 설계 원칙
--   * 앱의 Project 타입(src/types/index.ts)을 "통째로" layout_data(jsonb)에 보존.
--     - 이미지는 이미 경량 dataURL 로 Project JSON 안에 인라인 저장됨(외부 파일 없음).
--     - GLB 모델은 현재 브라우저 IndexedDB 캐시만 사용(MODEL_STORAGE_ENABLED=false) → 여기서 다루지 않음.
--   * 조회/정렬/RLS 를 위해 name/created_at/updated_at 만 최상위 컬럼으로 승격(비정규화).
--     원본(단일 소스)은 언제나 layout_data. 읽을 때 layout_data 로 hydrate.
--   * 프로젝트 id 는 앱이 client 에서 생성(crypto.randomUUID, 구형 폴백은 비-UUID 문자열)하므로
--     PK 를 uuid 가 아닌 TEXT 로 두어 기존 id 를 무손실 보존.
--   * publishable(anon) 키만 프론트엔드에서 사용. service_role 키는 절대 프론트엔드에 넣지 않음.
--   * 모든 공개 테이블에 RLS 활성화. 사용자는 자신의 데이터만 접근. 공유 링크는 토큰 기반 RPC 로만 읽기.
--
-- 이 파일은 재실행 가능(idempotent)하도록 작성됨(if not exists / drop policy if exists / create or replace).
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣어 1회 실행하세요.
-- ============================================================================

-- gen_random_uuid() 용 (Supabase 는 보통 기본 활성. 안전하게 보장)
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1) projects — 하나의 행사(프로젝트). 전체 Project JSON 을 layout_data 에 보존.
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id          text primary key default gen_random_uuid()::text,  -- 앱이 생성한 Project.id 를 그대로 저장
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,     -- Supabase Auth uid (익명/추후 Google)
  name        text not null default '',
  layout_data jsonb not null,                                     -- 전체 Project 직렬화(단일 소스)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.projects is 'Booth Layout Planner 프로젝트. layout_data 에 전체 Project JSON 보존.';
comment on column public.projects.user_id     is 'Supabase Auth uid. Firebase UID 와는 별개(서로 다른 인증체계).';
comment on column public.projects.layout_data is '앱 Project 객체 전체(JSON). 이미지 dataURL 포함. 원본(단일 소스).';

create index if not exists projects_user_id_idx        on public.projects (user_id);
create index if not exists projects_user_updated_idx   on public.projects (user_id, updated_at desc);

-- ----------------------------------------------------------------------------
-- 2) project_shares — 공유 링크 토큰 → 프로젝트 매핑 (Firestore shares/{shareId} 대응)
--    비로그인 사용자는 이 테이블을 직접 읽지 않고, 아래 get_project_by_share_token() RPC 로만 접근.
-- ----------------------------------------------------------------------------
create table if not exists public.project_shares (
  id          uuid primary key default gen_random_uuid(),
  project_id  text not null references public.projects (id) on delete cascade,
  share_token text not null unique,                               -- 앱의 shareId(랜덤 토큰)
  permission  text not null default 'view'                        -- 'view' | 'edit' (app: sharePermission)
                check (permission in ('view', 'edit')),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz                                         -- null = 무기한
);

comment on table public.project_shares is '공유 링크(share_token) → 프로젝트 매핑. 비로그인 조회는 get_project_by_share_token() RPC 로만.';

create index if not exists project_shares_project_id_idx on public.project_shares (project_id);
-- share_token 은 unique 제약으로 이미 인덱스가 생성됨.

-- ----------------------------------------------------------------------------
-- 3) user_libraries — 사용자 전역 집기/에셋 라이브러리 (Firestore libraries/{uid} 대응)
--    Project 와 무관하게 사용자 단위로 공유되는 집기/에셋. StorageProvider 인터페이스 충족용.
--    (원치 않으면 이 블록은 생략 가능 — 그 경우 provider 는 fixtures/assets 를 로컬 캐시로만 처리)
-- ----------------------------------------------------------------------------
create table if not exists public.user_libraries (
  user_id    uuid primary key default auth.uid()
               references auth.users (id) on delete cascade,
  fixtures   jsonb not null default '[]'::jsonb,                  -- FixtureDef[]
  assets     jsonb not null default '[]'::jsonb,                  -- Asset[]
  updated_at timestamptz not null default now()
);

comment on table public.user_libraries is '사용자 전역 집기(fixtures)/에셋(assets) 라이브러리. Firestore libraries/{uid} 대응.';

-- ----------------------------------------------------------------------------
-- updated_at 자동 갱신 트리거
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

drop trigger if exists user_libraries_set_updated_at on public.user_libraries;
create trigger user_libraries_set_updated_at
  before update on public.user_libraries
  for each row execute function public.set_updated_at();

-- ============================================================================
-- RLS (Row Level Security)
-- ============================================================================
alter table public.projects       enable row level security;
alter table public.project_shares enable row level security;
alter table public.user_libraries enable row level security;

-- ---- projects: 소유자(auth.uid())만 CRUD ----------------------------------
drop policy if exists projects_select_own on public.projects;
create policy projects_select_own on public.projects
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists projects_insert_own on public.projects;
create policy projects_insert_own on public.projects
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists projects_update_own on public.projects;
create policy projects_update_own on public.projects
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists projects_delete_own on public.projects;
create policy projects_delete_own on public.projects
  for delete to authenticated
  using (user_id = auth.uid());

-- ---- project_shares: 해당 프로젝트 소유자만 링크 관리 -----------------------
--     (비로그인 읽기는 RPC 로만 — 아래 SECURITY DEFINER 함수)
drop policy if exists project_shares_owner_all on public.project_shares;
create policy project_shares_owner_all on public.project_shares
  for all to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_shares.project_id and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = project_shares.project_id and p.user_id = auth.uid()
    )
  );

-- ---- user_libraries: 소유자만 CRUD ----------------------------------------
drop policy if exists user_libraries_all_own on public.user_libraries;
create policy user_libraries_all_own on public.user_libraries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================================
-- 공유 링크 공개 조회용 RPC (SECURITY DEFINER)
--   - 토큰이 유효하고 만료되지 않았을 때만 해당 프로젝트의 layout_data 를 반환.
--   - RLS 를 우회하지만, 유효한 토큰이 있는 단 하나의 프로젝트만 노출 → 안전.
--   - anon(비로그인) + authenticated 모두 실행 가능.
-- ============================================================================
create or replace function public.get_project_by_share_token(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.layout_data
  from public.project_shares s
  join public.projects p on p.id = s.project_id
  where s.share_token = p_token
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;

revoke all on function public.get_project_by_share_token(text) from public;
grant execute on function public.get_project_by_share_token(text) to anon, authenticated;

-- ============================================================================
-- 완료. 다음: 앱에서 VITE_STORAGE_PROVIDER=supabase 로 SupabaseStorageProvider 를 켜고
--            익명 로그인 → 프로젝트 CRUD/공유를 검증합니다. (별도 단계)
-- ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Project, FixtureDef, Layout, Asset, SharePermission } from '../types';
import type { StorageProvider } from './StorageProvider';
import { LocalStorageProvider } from './LocalStorageProvider';
import { supabase } from '../supabase/client';
import { ensureSupabaseAuth } from '../supabase/auth';
import { getProjectLastModified } from '../utils/project';

/**
 * SupabaseStorageProvider
 *
 * Supabase(Postgres)를 기본 저장소로, LocalStorage 를 캐시/백업/오프라인 폴백으로 사용합니다.
 * FirestoreStorageProvider 와 동일한 캐시 전략을 따르며, v1.2.6 의 "저장 성공 판정" 규칙을 유지합니다.
 *   - 저장: 캐시(localStorage) 먼저 반영(실패는 비치명적·경고만) → Supabase 저장(실패 시 예외로 상태 표시)
 *   - 불러오기: Supabase 최신본 → 캐시 갱신(실패해도 최신 데이터 반환), 클라우드 실패 시 캐시 반환(오프라인)
 *
 * Supabase 스키마 (supabase/migrations/001_initial_storage.sql)
 *   projects(id text, user_id uuid, name text, layout_data jsonb=Project 전체, created_at, updated_at)
 *   project_shares(project_id text, share_token text unique, permission, expires_at)
 *   user_libraries(user_id uuid, fixtures jsonb, assets jsonb)
 *   get_project_by_share_token(text) → 유효 토큰의 projects.layout_data (SECURITY DEFINER, 비로그인 조회)
 *
 * ⚠️ user_id 는 Supabase Auth uid 입니다(Firebase uid 와 무관). RLS 로 소유자만 접근합니다.
 */

const FIXTURES_CACHE_KEY = 'blp:fixtures';
const ASSETS_CACHE_KEY = 'blp:assets';

/** provider 는 isSupabaseConfigured 일 때만 생성되므로 client 는 non-null 이어야 함 */
function client(): SupabaseClient {
  if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
  return supabase;
}

/** layout_data(jsonb) → Project (선택 필드/구버전 하위 호환: layouts 배열 보정) */
function hydrate(raw: unknown): Project {
  const p = (raw ?? {}) as Project;
  return { ...p, layouts: p.layouts ?? [] };
}

export class SupabaseStorageProvider implements StorageProvider {
  private cache = new LocalStorageProvider();

  /** 익명 세션이 확보된 uid (없으면 익명 로그인). 인증 준비 전 저장/조회를 막는 게이트 역할. */
  private uid(): Promise<string> {
    return ensureSupabaseAuth();
  }

  // ---------- Project ----------
  async getProjects(): Promise<Project[]> {
    try {
      const uid = await this.uid();
      const { data, error } = await client()
        .from('projects')
        .select('layout_data, updated_at')
        .eq('user_id', uid)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      const projects = (data ?? []).map((r) => hydrate(r.layout_data));
      // 캐시 갱신은 비치명적(용량 초과 등으로 실패해도 클라우드 목록은 반환)
      for (const p of projects) {
        try {
          await this.cache.saveProject(p);
        } catch (cacheErr) {
          console.warn('[Supabase getProjects] local cache write failed', cacheErr);
        }
      }
      return projects.sort((a, b) => getProjectLastModified(b) - getProjectLastModified(a));
    } catch (e) {
      console.warn('[Supabase getProjects] cloud read failed; using local cache', e);
      return this.cache.getProjects();
    }
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      await this.uid();
      const { data, error } = await client()
        .from('projects')
        .select('layout_data')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return this.cache.getProject(id);
      const p = hydrate(data.layout_data);
      // 캐시 갱신 실패해도 방금 받은 최신 클라우드 데이터를 버리지 않는다.
      try {
        await this.cache.saveProject(p);
      } catch (cacheErr) {
        console.warn('[Supabase getProject] local cache write failed; returning cloud data', cacheErr);
      }
      return p;
    } catch (e) {
      console.warn('[Supabase getProject] cloud read failed; using local cache', e);
      return this.cache.getProject(id);
    }
  }

  async saveProject(project: Project): Promise<void> {
    // 캐시(localStorage)는 보조 저장소. 큰 이미지 dataURL 누적으로 QuotaExceededError 가 나도
    // 원본(Supabase) 저장까지 막지 않도록 캐시 실패는 비치명적(경고만)으로 처리한다. (v1.2.6 규칙)
    try {
      await this.cache.saveProject(project);
    } catch (e) {
      console.warn('[Supabase saveProject] local cache write failed (용량 초과 가능) — 클라우드 저장은 계속', e);
    }

    const uid = await this.uid();
    // projects.name 과 layout_data.name 이 어긋나지 않도록 항상 project.name 을 단일 소스로 사용
    const row = {
      id: project.id,
      user_id: uid,
      name: project.name,
      layout_data: project,
    };
    const { error } = await client().from('projects').upsert(row, { onConflict: 'id' });
    if (error) throw error; // 클라우드 저장 실패는 예외로 올려 상태('저장 실패')로 표시

    // 공유 링크(project_shares) 동기화 — 실패해도 프로젝트 본문 저장은 성공으로 유지
    if (project.shareId) {
      try {
        if (project.shareEnabled) {
          const permission: SharePermission = project.sharePermission ?? 'view';
          await client()
            .from('project_shares')
            .upsert(
              { project_id: project.id, share_token: project.shareId, permission },
              { onConflict: 'share_token' },
            );
        } else {
          await client().from('project_shares').delete().eq('share_token', project.shareId);
        }
      } catch (e) {
        console.warn('[Supabase saveProject] 공유 링크 동기화 실패(본문 저장은 성공)', e);
      }
    }
  }

  async deleteProject(id: string): Promise<void> {
    await this.cache.deleteProject(id);
    await this.uid();
    // project_shares 는 FK on delete cascade 로 함께 정리됨
    const { error } = await client().from('projects').delete().eq('id', id);
    if (error) throw error;
  }

  async getProjectByShareId(shareId: string): Promise<Project | null> {
    // 공유 조회는 비로그인 가능 — SECURITY DEFINER RPC 로 유효/미만료 토큰만 조회
    try {
      const { data, error } = await client().rpc('get_project_by_share_token', { p_token: shareId });
      if (error) throw error;
      if (!data) return this.cache.getProjectByShareId(shareId);
      const p = hydrate(data);
      if (!p.shareEnabled) return null; // 링크 비활성화됨(방어적 확인)
      try {
        await this.cache.saveProject(p);
      } catch {
        /* 캐시 실패는 무시 */
      }
      return p;
    } catch (e) {
      console.warn('[Supabase getProjectByShareId] RPC 실패; 로컬 캐시 조회', e);
      return this.cache.getProjectByShareId(shareId);
    }
  }

  // ---------- Fixture / Asset 라이브러리 (user_libraries, uid 단위) ----------
  private async readLibraries(): Promise<{ fixtures: FixtureDef[]; assets: Asset[] }> {
    const uid = await this.uid();
    const { data, error } = await client()
      .from('user_libraries')
      .select('fixtures, assets')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    return {
      fixtures: (data?.fixtures ?? []) as FixtureDef[],
      assets: (data?.assets ?? []) as Asset[],
    };
  }

  /** 부분 upsert: 제공한 컬럼만 갱신(다른 컬럼 보존). PostgREST 는 payload 에 없는 컬럼을 SET 하지 않음. */
  private async writeFixtures(fixtures: FixtureDef[]): Promise<void> {
    const uid = await this.uid();
    const { error } = await client()
      .from('user_libraries')
      .upsert({ user_id: uid, fixtures }, { onConflict: 'user_id' });
    if (error) throw error;
  }

  private async writeAssets(assets: Asset[]): Promise<void> {
    const uid = await this.uid();
    const { error } = await client()
      .from('user_libraries')
      .upsert({ user_id: uid, assets }, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async getFixtures(): Promise<FixtureDef[]> {
    try {
      const { fixtures } = await this.readLibraries();
      try {
        localStorage.setItem(FIXTURES_CACHE_KEY, JSON.stringify(fixtures)); // 삭제 반영 포함 전체 동기화
      } catch {
        /* 캐시 실패 무시 */
      }
      return fixtures;
    } catch (e) {
      console.warn('[Supabase getFixtures] cloud read failed; using local cache', e);
      return this.cache.getFixtures();
    }
  }

  async getFixture(id: string): Promise<FixtureDef | null> {
    const fixtures = await this.getFixtures();
    return fixtures.find((f) => f.id === id) ?? null;
  }

  async saveFixture(fixture: FixtureDef): Promise<void> {
    await this.cache.saveFixture(fixture);
    const { fixtures } = await this.readLibraries();
    const idx = fixtures.findIndex((f) => f.id === fixture.id);
    if (idx >= 0) fixtures[idx] = fixture;
    else fixtures.push(fixture);
    await this.writeFixtures(fixtures);
  }

  async saveFixtures(fixtures: FixtureDef[]): Promise<void> {
    await this.cache.saveFixtures(fixtures);
    await this.writeFixtures(fixtures);
  }

  async deleteFixture(id: string): Promise<void> {
    await this.cache.deleteFixture(id);
    const { fixtures } = await this.readLibraries();
    await this.writeFixtures(fixtures.filter((f) => f.id !== id));
  }

  async getAssets(): Promise<Asset[]> {
    try {
      const { assets } = await this.readLibraries();
      try {
        localStorage.setItem(ASSETS_CACHE_KEY, JSON.stringify(assets));
      } catch {
        /* 캐시 실패 무시 */
      }
      return assets;
    } catch (e) {
      console.warn('[Supabase getAssets] cloud read failed; using local cache', e);
      return this.cache.getAssets();
    }
  }

  async saveAsset(asset: Asset): Promise<void> {
    await this.cache.saveAsset(asset);
    const { assets } = await this.readLibraries();
    const idx = assets.findIndex((a) => a.id === asset.id);
    if (idx >= 0) assets[idx] = asset;
    else assets.push(asset);
    await this.writeAssets(assets);
  }

  async deleteAsset(id: string): Promise<void> {
    await this.cache.deleteAsset(id);
    const { assets } = await this.readLibraries();
    await this.writeAssets(assets.filter((a) => a.id !== id));
  }

  // ---------- Layout (프로젝트 문서에 임베드 — Firestore/Local 과 동일) ----------
  async getLayouts(projectId: string): Promise<Layout[]> {
    const project = await this.getProject(projectId);
    return project?.layouts ?? [];
  }

  async saveLayout(projectId: string, layout: Layout): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;
    const layouts = [...project.layouts];
    const idx = layouts.findIndex((l) => l.id === layout.id);
    if (idx >= 0) layouts[idx] = layout;
    else layouts.push(layout);
    await this.saveProject({ ...project, layouts });
  }

  async deleteLayout(projectId: string, layoutId: string): Promise<void> {
    const project = await this.getProject(projectId);
    if (!project) return;
    await this.saveProject({
      ...project,
      layouts: project.layouts.filter((l) => l.id !== layoutId),
    });
  }
}

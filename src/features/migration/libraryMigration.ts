/**
 * Firebase → Supabase **라이브러리(user_libraries: fixtures/assets)** 이전 (로컬 전용).
 *
 * 정책: merge 아님 — Firebase 라이브러리 **전체로 교체**(id 보존). 단, 현재 Supabase 라이브러리가
 * "앱 기본 시드"만인 경우에만 안전 교체 허용. 사용자 생성 항목이 있으면 차단.
 * 원자성: fixtures/assets 를 **한 번의 upsert** 로 함께 교체. 저장 후 재검증.
 *
 * ⚠️ Firebase 에는 접근/쓰기 없음(이 모듈은 Supabase 만 씀). Firebase 데이터는 exportFirestore(읽기전용)에서 받음.
 */
import type { FixtureDef, Asset, Project } from '../../types';
import { supabase } from '../../supabase/client';
import { verifySupabaseGoogleUser, type SupabaseUserCheck } from '../../supabase/auth';
import { DEFAULT_FIXTURES } from '../fixtures/defaults';
import { DEFAULT_ASSETS } from '../assets/defaults';
import { sha256Hex } from './validateBackup';

function client() {
  if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
  return supabase;
}

// ---- 기본 시드 판별 (id 는 시드 때 랜덤 부여 → 내용 기준) ----
const fixtureKey = (f: Partial<FixtureDef>) => `${f.name}|${f.shape}|${f.widthMm}|${f.depthMm}|${f.heightMm ?? ''}`;
const assetKey = (a: Partial<Asset>) => `${a.name}|${a.category}|${a.widthMm}|${a.depthMm}|${a.heightMm ?? ''}`;
const DEFAULT_FIXTURE_KEYS = new Set(DEFAULT_FIXTURES.map(fixtureKey));
const DEFAULT_ASSET_KEYS = new Set(DEFAULT_ASSETS.map(assetKey));

export interface SupabaseLibraryState {
  exists: boolean;
  fixtures: FixtureDef[];
  assets: Asset[];
  userCheck: SupabaseUserCheck;
}

/** 현재 Supabase user_libraries 읽기(현재 Google 사용자 소유). */
export async function readSupabaseLibrary(): Promise<SupabaseLibraryState> {
  const userCheck = await verifySupabaseGoogleUser();
  const { data: u } = await client().auth.getUser();
  const uid = u.user?.id;
  if (!uid) return { exists: false, fixtures: [], assets: [], userCheck };
  const { data } = await client().from('user_libraries').select('fixtures, assets').eq('user_id', uid).maybeSingle();
  return {
    exists: !!data,
    fixtures: (data?.fixtures ?? []) as FixtureDef[],
    assets: (data?.assets ?? []) as Asset[],
    userCheck,
  };
}

// ---- 참조 fixtureDefId (프로젝트의 배치 집기) ----
export function referencedFixtureDefIds(projects: Project[]): string[] {
  const ids = new Set<string>();
  for (const p of projects) {
    for (const l of p.layouts ?? []) {
      for (const pf of l.placedFixtures ?? []) if (pf.fixtureDefId) ids.add(pf.fixtureDefId);
    }
  }
  return [...ids];
}

/**
 * 현재 Supabase Google 사용자가 소유한 projects(=이전 대상)의 참조 fixtureDefId + 프로젝트 수.
 * 교체 차단 판정은 **이 스코프(이미 Supabase 에 있는 프로젝트)** 기준으로만 한다.
 */
export async function readSupabaseProjectReferences(): Promise<{ refs: string[]; projectCount: number }> {
  const { data: u } = await client().auth.getUser();
  const uid = u.user?.id;
  if (!uid) return { refs: [], projectCount: 0 };
  const { data } = await client().from('projects').select('layout_data').eq('user_id', uid);
  const projects = (data ?? []).map((r) => r.layout_data as Project);
  return { refs: referencedFixtureDefIds(projects), projectCount: projects.length };
}

export interface LibraryComparison {
  firebase: { fixtures: number; assets: number };
  supabase: { fixtures: number; assets: number };
  fixtureBothIds: number;
  fixtureFirebaseOnly: number;
  fixtureSupabaseOnly: number;
  fixtureSameIdDiffContent: number;
  assetBothIds: number;
  assetFirebaseOnly: number;
  assetSupabaseOnly: number;
  assetSameIdDiffContent: number;
  firebaseNameDups: number;
  dataUrlAssetCount: number;
  estAssetBytes: number;
  localModelIdItems: number;
  jsonSerializable: boolean;
  supabaseNonSeedFixtures: number; // 기본 시드가 아닌(사용자 생성 의심) 항목
  supabaseNonSeedAssets: number;
  supabaseIsSeedOnly: boolean; // true 면 안전 교체 가능
  // --- 스코프 분리: 교체 차단 판정은 "이전 대상(현재 Supabase 프로젝트)" 기준 ---
  targetProjectReferences: string[]; // 현재 Supabase 프로젝트들이 참조하는 fixtureDefId
  unresolvedTargetBefore: string[]; // 현재 Supabase 라이브러리에서 미해결
  unresolvedTargetAfter: string[]; // Firebase 라이브러리 교체 후 미해결(0 이어야 교체 허용) ← 게이트
  // --- Firebase 원본 전체의 댕글링(교체 차단에서 제외, 별도 경고) ---
  sourceDanglingReferences: string[]; // Firebase 원본 프로젝트 참조 중 정의 유실
  sourceDanglingByProject: { name: string; count: number }[];
}

export function compareLibraries(
  fb: { fixtures: FixtureDef[]; assets: Asset[]; projects: Project[] },
  supa: { fixtures: FixtureDef[]; assets: Asset[] },
  targetProjectRefs: string[], // 현재 Supabase 프로젝트(이전 대상)의 참조 fixtureDefId
): LibraryComparison {
  const idSet = (arr: { id: string }[]) => new Set(arr.map((x) => x.id));
  const fbFixIds = idSet(fb.fixtures), supaFixIds = idSet(supa.fixtures);
  const fbAssIds = idSet(fb.assets), supaAssIds = idSet(supa.assets);
  const inter = (a: Set<string>, b: Set<string>) => [...a].filter((x) => b.has(x));
  const only = (a: Set<string>, b: Set<string>) => [...a].filter((x) => !b.has(x));

  const fbFixById = new Map(fb.fixtures.map((f) => [f.id, f]));
  const supaFixById = new Map(supa.fixtures.map((f) => [f.id, f]));
  const fixDiff = inter(fbFixIds, supaFixIds).filter((id) => JSON.stringify(fbFixById.get(id)) !== JSON.stringify(supaFixById.get(id)));
  const fbAssById = new Map(fb.assets.map((a) => [a.id, a]));
  const supaAssById = new Map(supa.assets.map((a) => [a.id, a]));
  const assDiff = inter(fbAssIds, supaAssIds).filter((id) => JSON.stringify(fbAssById.get(id)) !== JSON.stringify(supaAssById.get(id)));

  // 이름 중복(Firebase)
  const fbFixNames = fb.fixtures.map((f) => f.name);
  const nameDups = fbFixNames.filter((n, i) => fbFixNames.indexOf(n) !== i).length;

  // 이전 대상(현재 Supabase 프로젝트) 스코프 미해결
  const unresolvedTargetBefore = targetProjectRefs.filter((id) => !supaFixIds.has(id));
  const unresolvedTargetAfter = targetProjectRefs.filter((id) => !fbFixIds.has(id));

  // Firebase 원본 전체의 댕글링(정의가 Firebase 라이브러리에 없음) — 교체 차단에서 제외, 별도 경고
  const sourceDangling = new Set<string>();
  const danglingByProject: { name: string; count: number }[] = [];
  for (const p of fb.projects) {
    const projRefs = referencedFixtureDefIds([p]);
    const missing = projRefs.filter((id) => !fbFixIds.has(id));
    if (missing.length > 0) danglingByProject.push({ name: p.name, count: missing.length });
    for (const id of missing) sourceDangling.add(id);
  }

  // 에셋 dataURL / 용량 / GLB
  const assetsJson = JSON.stringify(fb.assets);
  const fixturesJson = JSON.stringify(fb.fixtures);
  const dataUrlAssetCount = fb.assets.filter((a) => /data:[a-z]+\//i.test(JSON.stringify(a))).length;
  const estAssetBytes = new TextEncoder().encode(assetsJson).length;
  const localModelIdItems = new Set([...`${assetsJson}${fixturesJson}`.matchAll(/"localModelId"\s*:\s*"([^"]+)"/g)].map((m) => m[1])).size;

  let jsonSerializable = true;
  try {
    JSON.parse(JSON.stringify({ fixtures: fb.fixtures, assets: fb.assets }));
  } catch {
    jsonSerializable = false;
  }

  // 기본 시드 판별(내용 기준). 시드가 아닌 항목 = 사용자 생성 의심 → 교체 차단
  const nonSeedFixtures = supa.fixtures.filter((f) => !DEFAULT_FIXTURE_KEYS.has(fixtureKey(f)));
  const nonSeedAssets = supa.assets.filter((a) => !DEFAULT_ASSET_KEYS.has(assetKey(a)));

  return {
    firebase: { fixtures: fb.fixtures.length, assets: fb.assets.length },
    supabase: { fixtures: supa.fixtures.length, assets: supa.assets.length },
    fixtureBothIds: inter(fbFixIds, supaFixIds).length,
    fixtureFirebaseOnly: only(fbFixIds, supaFixIds).length,
    fixtureSupabaseOnly: only(supaFixIds, fbFixIds).length,
    fixtureSameIdDiffContent: fixDiff.length,
    assetBothIds: inter(fbAssIds, supaAssIds).length,
    assetFirebaseOnly: only(fbAssIds, supaAssIds).length,
    assetSupabaseOnly: only(supaAssIds, fbAssIds).length,
    assetSameIdDiffContent: assDiff.length,
    firebaseNameDups: nameDups,
    dataUrlAssetCount,
    estAssetBytes,
    localModelIdItems,
    jsonSerializable,
    supabaseNonSeedFixtures: nonSeedFixtures.length,
    supabaseNonSeedAssets: nonSeedAssets.length,
    supabaseIsSeedOnly: nonSeedFixtures.length === 0 && nonSeedAssets.length === 0,
    targetProjectReferences: targetProjectRefs,
    unresolvedTargetBefore,
    unresolvedTargetAfter,
    sourceDanglingReferences: [...sourceDangling],
    sourceDanglingByProject: danglingByProject,
  };
}

// ---- 현재 Supabase 라이브러리 백업 ----
export const LIB_BACKUP_SCHEMA_VERSION = 1;
export interface SupabaseLibraryBackup {
  schemaVersion: number;
  exportedAt: string;
  source: 'supabase';
  ownerRef: string;
  fixtures: FixtureDef[];
  assets: Asset[];
  integrity: { algo: 'sha256'; checksum: string; totalBytes: number };
}

export async function buildSupabaseLibraryBackup(state: SupabaseLibraryState, exportedAtIso: string): Promise<SupabaseLibraryBackup> {
  const base = { fixtures: state.fixtures, assets: state.assets };
  const payload = JSON.stringify(base);
  return {
    schemaVersion: LIB_BACKUP_SCHEMA_VERSION,
    exportedAt: exportedAtIso,
    source: 'supabase',
    ownerRef: `sb-${state.userCheck.uidTail ?? '????'}`,
    ...base,
    integrity: { algo: 'sha256', checksum: await sha256Hex(payload), totalBytes: new TextEncoder().encode(payload).length },
  };
}

// ---- 원자적 교체 + 저장 후 검증 ----
export type LibReplaceStatus = 'success' | 'verification_failed' | 'error';
export interface LibReplaceResult {
  status: LibReplaceStatus;
  reason?: string;
  verify?: {
    fixtures: number;
    assets: number;
    idSetsMatch: boolean;
    dataUrlAssetsMatch: boolean;
    ownerTail: string | null;
    referencedResolved: boolean;
    projectsUnchanged: boolean;
    sharesUnchanged: boolean;
  };
}

/**
 * Firebase 라이브러리 전체로 교체(원자적). 실행 전 백업 다운로드 완료 + 사용자 확인이 선행돼야 함(호출부 게이트).
 * 검증 스코프: **현재 Supabase 프로젝트(이전 대상)** 의 참조가 모두 해결되는지. 미이전 Firebase 프로젝트의 댕글링은 제외.
 */
export async function replaceSupabaseLibrary(
  fbFixtures: FixtureDef[],
  fbAssets: Asset[],
): Promise<LibReplaceResult> {
  try {
    // (1) 로그인 검증 — 비익명 Google + getSession/getUser/ensure 일치
    const check = await verifySupabaseGoogleUser();
    if (!check.ok) return { status: 'error', reason: `로그인 확인 실패(${check.reason}). 기존 Google 계정으로 다시 로그인 후 시도하세요.` };
    const { data: u } = await client().auth.getUser();
    const uid = u.user!.id;

    // 교체 전: projects/shares 개수 + 이전 대상 프로젝트 참조 캡처(교체가 이 테이블들을 건드리지 않음을 검증)
    const { count: projBefore } = await client().from('projects').select('id', { count: 'exact', head: true });
    const { count: shareBefore } = await client().from('project_shares').select('id', { count: 'exact', head: true });
    const { refs: targetRefs } = await readSupabaseProjectReferences();

    // (2) 원자적 교체: fixtures/assets 를 한 upsert 로 함께 저장(현재 uid 소유 행만)
    const { error } = await client()
      .from('user_libraries')
      .upsert({ user_id: uid, fixtures: fbFixtures, assets: fbAssets }, { onConflict: 'user_id' });
    if (error) return { status: 'error', reason: `저장 실패: ${error.message}` };

    // (3) 저장 후 재검증(같은 세션)
    const { data: after } = await client().from('user_libraries').select('fixtures, assets').eq('user_id', uid).maybeSingle();
    const afterFix = (after?.fixtures ?? []) as FixtureDef[];
    const afterAss = (after?.assets ?? []) as Asset[];
    const fbFixIds = new Set(fbFixtures.map((f) => f.id));
    const fbAssIds = new Set(fbAssets.map((a) => a.id));
    const afterFixIds = new Set(afterFix.map((f) => f.id));
    const afterAssIds = new Set(afterAss.map((a) => a.id));
    const idSetsMatch =
      fbFixIds.size === afterFixIds.size && [...fbFixIds].every((id) => afterFixIds.has(id)) &&
      fbAssIds.size === afterAssIds.size && [...fbAssIds].every((id) => afterAssIds.has(id));
    const dataUrlBefore = fbAssets.filter((a) => /data:[a-z]+\//i.test(JSON.stringify(a))).length;
    const dataUrlAfter = afterAss.filter((a) => /data:[a-z]+\//i.test(JSON.stringify(a))).length;
    // 이전 대상 프로젝트의 참조가 모두 해결되는지(미이전 프로젝트의 댕글링은 스코프 밖)
    const referencedResolved = targetRefs.every((id) => afterFixIds.has(id));

    const { count: projCount } = await client().from('projects').select('id', { count: 'exact', head: true });
    const { count: shareCount } = await client().from('project_shares').select('id', { count: 'exact', head: true });

    const verify = {
      fixtures: afterFix.length,
      assets: afterAss.length,
      idSetsMatch,
      dataUrlAssetsMatch: dataUrlBefore === dataUrlAfter,
      ownerTail: `…${uid.slice(-4)}`,
      referencedResolved,
      projectsUnchanged: (projCount ?? -1) === (projBefore ?? -2),
      sharesUnchanged: (shareCount ?? -1) === (shareBefore ?? -2),
    };

    const ok =
      verify.fixtures === fbFixtures.length &&
      verify.assets === fbAssets.length &&
      idSetsMatch &&
      verify.dataUrlAssetsMatch &&
      referencedResolved &&
      verify.projectsUnchanged &&
      verify.sharesUnchanged;

    if (!ok) return { status: 'verification_failed', reason: '교체 후 검증 불일치', verify };

    // (4) 로컬 캐시/시드 플래그 갱신 — 기본 시드가 다시 top-up 되지 않도록, 앱이 최신 라이브러리를 보도록
    try {
      localStorage.setItem('blp:fixtures', JSON.stringify(afterFix));
      localStorage.setItem('blp:assets', JSON.stringify(afterAss));
      localStorage.setItem('blp:assetSeedVersion', '999'); // 이후 기본 에셋 top-up 재발동 방지
    } catch {
      /* 캐시 실패 비치명적 */
    }

    return { status: 'success', verify };
  } catch (e) {
    return { status: 'error', reason: (e as Error)?.message ?? String(e) };
  }
}

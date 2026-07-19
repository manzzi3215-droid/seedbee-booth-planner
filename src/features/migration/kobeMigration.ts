/**
 * `7월 코베 베페` 전용 안전 이전 (로컬 전용 도구, /migrate ⑩ 섹션).
 *
 * 원칙(설계 승인본):
 *  - Firebase 원본·백업 JSON 은 절대 변경하지 않음(이 모듈은 Firebase 에 접근조차 하지 않음 — 쓰기/읽기 모두 없음).
 *  - 실제 쓰기(projects insert / project_shares insert)는 사용자가 최종 확인 버튼을 누른 뒤에만 실행.
 *  - 정의가 유실된 fixtureDefId 6개는 추측 복구/삭제하지 않음 — 배치 기록(id/좌표/회전/fixtureDefId)만 원본 그대로 보존.
 *  - 동일 project id 가 이미 있으면 skip(덮어쓰기·update·upsert 금지).
 *  - 공유 링크: shareId 토큰은 보존하되, project_shares.permission 은 **항상 'view'** 로만 저장한다
 *    (원본이 'edit' 이어도 자동 공개 편집 금지). layout_data 내부 sharePermission 원본값은 변경하지 않음(원본 보존).
 *  - 부분 실패 안전성: 프로젝트 insert 실패 → 공유 행 생성 안 함. 프로젝트 검증 실패 → SUCCESS 금지.
 *    공유 행/RPC 만 실패 → 'project_imported_share_failed' 로 구분 표시(성공 위장 금지). 자동 재시도·자동 삭제 없음.
 */
import type { Project, FixtureDef } from '../../types';
import { supabase } from '../../supabase/client';
import { verifySupabaseGoogleUser, type SupabaseUserCheck } from '../../supabase/auth';
import { isLibrarySeedLocked } from '../../supabase/libraryLock';
import { readSupabaseLibrary } from './libraryMigration';
import { sha256Hex } from './validateBackup';

export const KOBE_PROJECT_NAME = '7월 코베 베페';
/** 기대 라이브러리 상태(시드 잠금 완료 기준). 게이트 검증에 사용. */
export const KOBE_EXPECTED = { libFixtures: 13, libAssets: 36 } as const;

// ---------------------------------------------------------------------------
// 유실 참조 행(다운로드/검증용). uid·email·share token 은 포함하지 않음.
// ---------------------------------------------------------------------------
export interface KobeUnresolvedRow {
  fixtureDefId: string;
  layoutId: string;
  layoutName: string;
  placedFixtureId: string;
  xMm: number;
  yMm: number;
  rotationDeg: number;
  inLocalFixtures: boolean; // 프로젝트 어느 레이아웃의 localFixtures 에라도 정의가 있는가
  inFirebaseLibrary: boolean; // Firebase 전역 라이브러리에 정의가 있는가
}

/** placedFixtures 참조를 전역 라이브러리 + 모든 레이아웃 localFixtures 로 해석. */
function resolveRefs(project: Project, fbFixtures: FixtureDef[]) {
  const libIds = new Set(fbFixtures.map((f) => f.id));
  const localIds = new Set<string>();
  for (const l of project.layouts ?? []) {
    for (const lf of l.localFixtures ?? []) localIds.add(lf.id);
  }
  const placements: KobeUnresolvedRow[] = [];
  for (const l of project.layouts ?? []) {
    for (const pf of l.placedFixtures ?? []) {
      placements.push({
        fixtureDefId: pf.fixtureDefId,
        layoutId: l.id,
        layoutName: l.name,
        placedFixtureId: pf.id,
        xMm: pf.xMm,
        yMm: pf.yMm,
        rotationDeg: pf.rotationDeg,
        inLocalFixtures: localIds.has(pf.fixtureDefId),
        inFirebaseLibrary: libIds.has(pf.fixtureDefId),
      });
    }
  }
  return { placements, libIds, localIds };
}

/** 유실(전역·로컬 어디에도 정의 없음) 배치 행만 반환. */
export function buildUnresolvedRows(project: Project, fbFixtures: FixtureDef[]): KobeUnresolvedRow[] {
  const { placements } = resolveRefs(project, fbFixtures);
  return placements.filter((p) => !p.inFirebaseLibrary && !p.inLocalFixtures);
}

// ---------------------------------------------------------------------------
// 프리플라이트(읽기·계산만). Firebase read(②) 로 얻은 project/fixtures 로 계산.
// ---------------------------------------------------------------------------
export interface KobePreflight {
  found: boolean;
  projectId: string | null;
  layoutCount: number;
  placedFixtureCount: number;
  resolvedFixtureCount: number; // distinct fixtureDefId 해결(전역 or 로컬)
  unresolvedFixtureCount: number; // distinct fixtureDefId 유실
  unresolvedRows: KobeUnresolvedRow[];
  designAssetCount: number;
  productCount: number;
  vmdBoardCount: number;
  approxBytes: number;
  serializable: boolean;
  checksumHex: string | null;
  hasDataUrl: boolean;
  glbCount: number;
  shareEnabled: boolean;
  sharePermissionOriginal: string | null;
  hasShareId: boolean;
}

/** 로드된 Firebase 프로젝트에서 Kobe 프로젝트를 찾아 프리플라이트 계산. */
export async function analyzeKobe(projects: Project[], fbFixtures: FixtureDef[]): Promise<KobePreflight> {
  const p = projects.find((x) => x.name === KOBE_PROJECT_NAME) ?? null;
  if (!p) {
    return {
      found: false, projectId: null, layoutCount: 0, placedFixtureCount: 0, resolvedFixtureCount: 0,
      unresolvedFixtureCount: 0, unresolvedRows: [], designAssetCount: 0, productCount: 0, vmdBoardCount: 0,
      approxBytes: 0, serializable: false, checksumHex: null, hasDataUrl: false, glbCount: 0,
      shareEnabled: false, sharePermissionOriginal: null, hasShareId: false,
    };
  }
  const { placements } = resolveRefs(p, fbFixtures);
  const distinct = new Map<string, KobeUnresolvedRow>();
  for (const pl of placements) if (!distinct.has(pl.fixtureDefId)) distinct.set(pl.fixtureDefId, pl);
  const distinctRows = [...distinct.values()];
  const unresolvedRows = placements.filter((x) => !x.inFirebaseLibrary && !x.inLocalFixtures);
  const unresolvedDistinct = new Set(unresolvedRows.map((r) => r.fixtureDefId));

  const json = JSON.stringify(p);
  let serializable = true;
  try { JSON.parse(JSON.stringify(p)); } catch { serializable = false; }
  const glb = new Set([...json.matchAll(/"localModelId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]));
  const designAssetCount = (p.layouts ?? []).reduce((a, l) => a + (l.designAssets?.length ?? 0), 0);

  let checksumHex: string | null = null;
  try { checksumHex = await sha256Hex(json); } catch { checksumHex = null; }

  return {
    found: true,
    projectId: p.id,
    layoutCount: (p.layouts ?? []).length,
    placedFixtureCount: placements.length,
    resolvedFixtureCount: distinctRows.filter((r) => r.inFirebaseLibrary || r.inLocalFixtures).length,
    unresolvedFixtureCount: unresolvedDistinct.size,
    unresolvedRows,
    designAssetCount,
    productCount: (p.products ?? []).length,
    vmdBoardCount: (p.vmdBoards ?? []).length,
    approxBytes: new TextEncoder().encode(json).length,
    serializable,
    checksumHex,
    hasDataUrl: /data:[a-z]+\//i.test(json),
    glbCount: glb.size,
    shareEnabled: p.shareEnabled === true,
    sharePermissionOriginal: p.sharePermission ?? null,
    hasShareId: typeof p.shareId === 'string' && p.shareId.length > 0,
  };
}

// ---------------------------------------------------------------------------
// 다운로드 빌더 (uid·email·share token 미포함).
// ---------------------------------------------------------------------------
export function unresolvedToJson(rows: KobeUnresolvedRow[]): string {
  return JSON.stringify(
    {
      note: 'Firebase 원본에도 정의가 없는 배치 참조(placeholder). 추측 복구 금지. 좌표/회전/fixtureDefId 만 보존.',
      project: KOBE_PROJECT_NAME,
      count: rows.length,
      items: rows,
    },
    null,
    2,
  );
}

export function unresolvedToCsv(rows: KobeUnresolvedRow[]): string {
  const header = ['fixtureDefId', 'layoutId', 'layoutName', 'placedFixtureId', 'xMm', 'yMm', 'rotationDeg', 'inLocalFixtures', 'inFirebaseLibrary'];
  const esc = (v: unknown) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([r.fixtureDefId, r.layoutId, r.layoutName, r.placedFixtureId, r.xMm, r.yMm, r.rotationDeg, r.inLocalFixtures, r.inFirebaseLibrary].map(esc).join(','));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// 클라우드 게이트(읽기 전용): seed_locked / 라이브러리 13·36 / 동일 id 존재.
// ---------------------------------------------------------------------------
export interface KobeCloudGates {
  seedLocked: boolean;
  libFixtures: number;
  libAssets: number;
  idExists: boolean; // 현재 Supabase 에 동일 project id 존재?
  error?: string;
}

export async function readKobeCloudGates(projectId: string | null): Promise<KobeCloudGates> {
  if (!supabase) return { seedLocked: false, libFixtures: -1, libAssets: -1, idExists: false, error: 'Supabase 미설정' };
  try {
    const seedLocked = await isLibrarySeedLocked();
    const lib = await readSupabaseLibrary();
    let idExists = false;
    if (projectId) {
      const { data, error } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle();
      if (error) return { seedLocked, libFixtures: lib.fixtures.length, libAssets: lib.assets.length, idExists: false, error: error.message };
      idExists = !!data;
    }
    return { seedLocked, libFixtures: lib.fixtures.length, libAssets: lib.assets.length, idExists };
  } catch (e) {
    return { seedLocked: false, libFixtures: -1, libAssets: -1, idExists: false, error: (e as Error)?.message ?? String(e) };
  }
}

// ---------------------------------------------------------------------------
// 게이트 종합 판정(순수). 활성 조건 하나라도 실패 시 정확한 이유.
// ---------------------------------------------------------------------------
export interface KobeGateInput {
  preflight: KobePreflight | null;
  cloud: KobeCloudGates | null;
  targetUser: SupabaseUserCheck | null;
  backupDownloaded: boolean;
  unresolvedListDownloaded: boolean;
  busy: boolean;
}

export interface KobeGateResult {
  canImport: boolean;
  reasons: string[]; // 실패 사유(모두 나열)
  firstReason: string | null;
}

export function evaluateKobeGates(g: KobeGateInput): KobeGateResult {
  const reasons: string[] = [];
  if (!g.preflight?.found) reasons.push('프리플라이트: 로드된 Firebase 데이터에서 7월 코베 베페 프로젝트를 찾지 못했습니다(먼저 ② 데이터 조회).');
  if (g.preflight && !g.preflight.serializable) reasons.push('프리플라이트: 프로젝트 JSON 직렬화 실패.');
  if (!g.backupDownloaded) reasons.push('전체 Firebase 백업 JSON 다운로드(③)가 필요합니다.');
  if (!g.unresolvedListDownloaded) reasons.push('유실 6개 목록(JSON 또는 CSV) 다운로드가 필요합니다.');
  if (!g.targetUser?.ok) reasons.push(`Supabase 사용자 확인 실패: 비익명 Google + getSession/getUser/ensure uid 일치 필요(${g.targetUser?.reason ?? '미확인'}).`);
  if (!g.cloud) reasons.push('클라우드 게이트 미조회 — “게이트 재확인”을 눌러주세요.');
  if (g.cloud?.error) reasons.push(`클라우드 게이트 조회 오류: ${g.cloud.error}`);
  if (g.cloud && !g.cloud.seedLocked) reasons.push('seed_locked=true 가 아닙니다(시드 잠금 필요).');
  if (g.cloud && (g.cloud.libFixtures !== KOBE_EXPECTED.libFixtures || g.cloud.libAssets !== KOBE_EXPECTED.libAssets))
    reasons.push(`user_libraries 가 13/36 이 아닙니다(현재 ${g.cloud.libFixtures}/${g.cloud.libAssets}).`);
  if (g.cloud?.idExists) reasons.push('동일 project id 가 이미 Supabase 에 존재합니다(덮어쓰기 금지 → skip 대상).');
  if (g.busy) reasons.push('처리 중입니다.');
  return { canImport: reasons.length === 0, reasons, firstReason: reasons[0] ?? null };
}

// ---------------------------------------------------------------------------
// 이전 후 검증 결과(항목별). 모두 통과해야 프로젝트 SUCCESS.
// ---------------------------------------------------------------------------
export interface KobeProjectVerify {
  found: boolean;
  idMatch: boolean;
  nameMatch: boolean;
  layoutCountMatch: boolean;
  createdAtMatch: boolean;
  updatedAtMatch: boolean;
  boothConfigPresent: boolean;
  designAssetsMatch: boolean;
  productsMatch: boolean;
  vmdBoardsMatch: boolean;
  placedFixturesMatch: boolean; // 총 배치 수 동일(12)
  resolvedMatch: boolean; // 해결 distinct 동일(6)
  unresolvedMatch: boolean; // 유실 distinct 동일(6)
  unresolvedGeometryMatch: boolean; // 유실 6개 fixtureDefId/x/y/rotation 원본 일치
  shareFieldsMatch: boolean; // layout_data 내부 shareId/shareEnabled/sharePermission 원본 일치
  seedLockedStillTrue: boolean;
  libraryUnchanged: boolean; // 13/36
  otherProjectUnchanged: boolean; // 베페 부스_2 등 기존 행 불변
  allPass: boolean;
}

export type KobeImportStatus =
  | 'success'
  | 'skipped_existing'
  | 'error'
  | 'verification_failed'
  | 'project_imported_share_failed';

export type KobeShareOutcome = 'not_requested' | 'created_view' | 'failed';

export interface KobeImportResult {
  status: KobeImportStatus;
  reason?: string;
  supabaseUserIdTail?: string;
  projectVerify?: KobeProjectVerify;
  shareOutcome: KobeShareOutcome;
  shareReason?: string;
  shareRpcResolved?: boolean;
  sharePermissionStored?: 'view' | null; // project_shares.permission (항상 view)
}

function client() {
  if (!supabase) throw new Error('Supabase 클라이언트가 초기화되지 않았습니다.');
  return supabase;
}

/** 배치 참조 요약(검증 비교용). */
function refSummary(project: Project, fbFixtures: FixtureDef[]) {
  const { placements } = resolveRefs(project, fbFixtures);
  const resolved = new Set(placements.filter((p) => p.inFirebaseLibrary || p.inLocalFixtures).map((p) => p.fixtureDefId));
  const unresolved = placements.filter((p) => !p.inFirebaseLibrary && !p.inLocalFixtures);
  return { total: placements.length, resolvedDistinct: resolved.size, unresolved };
}

/**
 * 최종 실행. 사용자 확인 후에만 호출.
 * A 재인증 → B 동일 id 재확인(skip) → C 프로젝트 insert → D 재조회·핵심검증 →
 * E (선택) project_shares view 생성 → F 익명 RPC 검증 → G 전부 통과 시 SUCCESS.
 */
export async function importKobeProject(
  project: Project,
  fbFixtures: FixtureDef[],
  opts: { reactivateShareView: boolean },
): Promise<KobeImportResult> {
  try {
    // A. 재인증
    const check = await verifySupabaseGoogleUser();
    if (!check.ok) {
      return { status: 'error', reason: `로그인 확인 실패(${check.reason}). 기존 Google 계정으로 다시 로그인 후 시도하세요.`, shareOutcome: 'not_requested' };
    }
    const { data: u } = await client().auth.getUser();
    const uid = u.user!.id;
    const tail = `…${uid.slice(-4)}`;

    // 기존 프로젝트 메타(불변 검증용, layout_data 미포함 — 가벼운 조회)
    const beforeList = await client().from('projects').select('id, name, updated_at').eq('user_id', uid);
    if (beforeList.error) return { status: 'error', reason: `기존 프로젝트 조회 실패: ${beforeList.error.message}`, shareOutcome: 'not_requested' };
    const beforeRows = (beforeList.data ?? []) as { id: string; name: string; updated_at: string }[];

    // B. 동일 id 재확인 → 존재 시 skip(쓰기 없음)
    const existing = await client().from('projects').select('id').eq('id', project.id).maybeSingle();
    if (existing.error) return { status: 'error', reason: `동일 id 조회 실패: ${existing.error.message}`, shareOutcome: 'not_requested' };
    if (existing.data) {
      return { status: 'skipped_existing', reason: '동일 project id 가 이미 존재합니다(덮어쓰기·update·upsert 금지).', supabaseUserIdTail: tail, shareOutcome: 'not_requested' };
    }

    // C. 프로젝트 1행 insert (전체 Project JSON verbatim). insert 실패 시 공유 행 생성 안 함.
    const { error: insErr } = await client().from('projects').insert({ id: project.id, user_id: uid, name: project.name, layout_data: project });
    if (insErr) return { status: 'error', reason: `프로젝트 insert 실패: ${insErr.message}`, supabaseUserIdTail: tail, shareOutcome: 'not_requested' };

    // D. 재조회·핵심 검증(현재 세션)
    const verify = await verifyKobeImport(project, fbFixtures, uid, beforeRows);
    if (!verify.allPass) {
      return { status: 'verification_failed', reason: '이전 후 검증 불일치 — SUCCESS 로 표시하지 않습니다. 자동 롤백/삭제는 하지 않으며, 원인 확인 후 수동 대응이 필요합니다.', supabaseUserIdTail: tail, projectVerify: verify, shareOutcome: 'not_requested' };
    }

    // E. 공유 보기전용 재활성화(선택 시에만). shareId 보존, permission 은 항상 'view'.
    if (!opts.reactivateShareView) {
      return { status: 'success', supabaseUserIdTail: tail, projectVerify: verify, shareOutcome: 'not_requested' };
    }
    if (!project.shareId) {
      return { status: 'success', supabaseUserIdTail: tail, projectVerify: verify, shareOutcome: 'not_requested', shareReason: '원본에 shareId 가 없어 공유 행을 만들지 않았습니다.' };
    }
    const { error: shErr } = await client().from('project_shares').insert({ project_id: project.id, share_token: project.shareId, permission: 'view' });
    if (shErr) {
      return { status: 'project_imported_share_failed', reason: '프로젝트 이전·검증은 성공했으나 공유 행 생성에 실패했습니다(성공으로 위장하지 않음). 자동 재시도 없음 — 수동 확인 필요.', supabaseUserIdTail: tail, projectVerify: verify, shareOutcome: 'failed', shareReason: shErr.message, sharePermissionStored: null };
    }

    // F. 익명 접근 경로(RPC)로 토큰 조회 검증
    const rpc = await client().rpc('get_project_by_share_token', { p_token: project.shareId });
    const rpcProject = (rpc.data ?? null) as Project | null;
    const rpcResolved = !rpc.error && !!rpcProject && rpcProject.id === project.id;
    if (!rpcResolved) {
      return { status: 'project_imported_share_failed', reason: '공유 행은 생성됐으나 익명 RPC 조회 검증에 실패했습니다(성공 위장 금지). 수동 확인 필요.', supabaseUserIdTail: tail, projectVerify: verify, shareOutcome: 'failed', shareReason: rpc.error?.message ?? 'RPC 결과 불일치', shareRpcResolved: false, sharePermissionStored: 'view' };
    }

    // G. 전부 통과
    return { status: 'success', supabaseUserIdTail: tail, projectVerify: verify, shareOutcome: 'created_view', shareRpcResolved: true, sharePermissionStored: 'view' };
  } catch (e) {
    return { status: 'error', reason: (e as Error)?.message ?? String(e), shareOutcome: 'not_requested' };
  }
}

/** 이전 후 항목별 검증(읽기). Firebase 원본은 건드리지 않음. */
export async function verifyKobeImport(
  original: Project,
  fbFixtures: FixtureDef[],
  uid: string,
  beforeRows: { id: string; name: string; updated_at: string }[],
): Promise<KobeProjectVerify> {
  const fail = (): KobeProjectVerify => ({
    found: false, idMatch: false, nameMatch: false, layoutCountMatch: false, createdAtMatch: false, updatedAtMatch: false,
    boothConfigPresent: false, designAssetsMatch: false, productsMatch: false, vmdBoardsMatch: false, placedFixturesMatch: false,
    resolvedMatch: false, unresolvedMatch: false, unresolvedGeometryMatch: false, shareFieldsMatch: false,
    seedLockedStillTrue: false, libraryUnchanged: false, otherProjectUnchanged: false, allPass: false,
  });

  const back = await client().from('projects').select('name, layout_data').eq('id', original.id).maybeSingle();
  if (back.error || !back.data) return fail();
  const imp = back.data.layout_data as Project;

  const oExp = refSummary(original, fbFixtures);
  const iExp = refSummary(imp, fbFixtures);

  const oDesign = (original.layouts ?? []).reduce((a, l) => a + (l.designAssets?.length ?? 0), 0);
  const iDesign = (imp.layouts ?? []).reduce((a, l) => a + (l.designAssets?.length ?? 0), 0);

  // 유실 6개 geometry 원본 일치(placedFixtureId 기준 매칭)
  const oUnres = new Map(oExp.unresolved.map((r) => [r.placedFixtureId, r]));
  let geomOk = oExp.unresolved.length === iExp.unresolved.length && oExp.unresolved.length > 0;
  if (geomOk) {
    for (const ir of iExp.unresolved) {
      const or = oUnres.get(ir.placedFixtureId);
      if (!or || or.fixtureDefId !== ir.fixtureDefId || or.xMm !== ir.xMm || or.yMm !== ir.yMm || or.rotationDeg !== ir.rotationDeg) { geomOk = false; break; }
    }
  }

  // 공유 필드(layout_data 내부) 원본 보존
  const shareFieldsMatch = imp.shareId === original.shareId && imp.shareEnabled === original.shareEnabled && imp.sharePermission === original.sharePermission;

  // 클라우드 불변: seed_locked / 라이브러리 13·36
  let seedLockedStillTrue = false, libFix = -1, libAss = -1;
  try {
    seedLockedStillTrue = await isLibrarySeedLocked();
    const lib = await readSupabaseLibrary();
    libFix = lib.fixtures.length; libAss = lib.assets.length;
  } catch { /* 실패 시 아래 false 로 처리 */ }
  const libraryUnchanged = libFix === KOBE_EXPECTED.libFixtures && libAss === KOBE_EXPECTED.libAssets;

  // 기존 프로젝트 행 불변(베페 부스_2 등): before 의 각 행이 그대로 존재하고 updated_at 변화 없음
  const afterList = await client().from('projects').select('id, name, updated_at').eq('user_id', uid);
  const afterRows = (afterList.data ?? []) as { id: string; name: string; updated_at: string }[];
  const afterById = new Map(afterRows.map((r) => [r.id, r]));
  const otherProjectUnchanged =
    !afterList.error &&
    beforeRows.every((b) => {
      const a = afterById.get(b.id);
      return a && a.name === b.name && a.updated_at === b.updated_at;
    }) &&
    afterRows.length === beforeRows.length + 1; // 정확히 새 1행만 추가

  const v: KobeProjectVerify = {
    found: true,
    idMatch: imp.id === original.id,
    nameMatch: back.data.name === original.name && imp.name === original.name,
    layoutCountMatch: (imp.layouts?.length ?? 0) === (original.layouts?.length ?? 0),
    createdAtMatch: imp.createdAt === original.createdAt,
    updatedAtMatch: imp.updatedAt === original.updatedAt,
    boothConfigPresent: !!imp.boothConfig,
    designAssetsMatch: iDesign === oDesign,
    productsMatch: (imp.products?.length ?? 0) === (original.products?.length ?? 0),
    vmdBoardsMatch: (imp.vmdBoards?.length ?? 0) === (original.vmdBoards?.length ?? 0),
    placedFixturesMatch: iExp.total === oExp.total,
    resolvedMatch: iExp.resolvedDistinct === oExp.resolvedDistinct,
    unresolvedMatch: iExp.unresolved.length === oExp.unresolved.length,
    unresolvedGeometryMatch: geomOk,
    shareFieldsMatch,
    seedLockedStillTrue,
    libraryUnchanged,
    otherProjectUnchanged,
    allPass: false,
  };
  v.allPass =
    v.found && v.idMatch && v.nameMatch && v.layoutCountMatch && v.createdAtMatch && v.updatedAtMatch &&
    v.boothConfigPresent && v.designAssetsMatch && v.productsMatch && v.vmdBoardsMatch && v.placedFixturesMatch &&
    v.resolvedMatch && v.unresolvedMatch && v.unresolvedGeometryMatch && v.shareFieldsMatch &&
    v.seedLockedStillTrue && v.libraryUnchanged && v.otherProjectUnchanged;
  return v;
}

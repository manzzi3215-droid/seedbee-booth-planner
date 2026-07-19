/**
 * 로컬 전용 Firestore→Supabase 이전 화면 (/migrate).
 *
 * - VITE_ENABLE_MIGRATION_TOOL=true 일 때만 활성. 기본 false. production 노출 경고 표시.
 * - production UI 메뉴에는 노출하지 않고 직접 /migrate 로만 접근.
 * - 실제 import 는 사용자가 버튼 클릭 + 최종 확인창 승인 시에만 실행(자동 import 없음).
 */
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import type { Project } from '../../types';
import {
  signInFirebaseReadOnly,
  readFirestoreData,
  buildBackup,
  type FirestoreReadResult,
} from './exportFirestore';
import { validateBackup, type ValidationReport } from './validateBackup';
import type { FirebaseBackup } from './backupTypes';
import {
  importProjectToSupabase,
  compareImported,
  checkSupabaseTargetUser,
  type ImportResult,
  type ImportComparison,
} from './importSupabase';
import type { SupabaseUserCheck } from '../../supabase/auth';
import { isLibrarySeedLocked, setLibrarySeedLocked, type SeedLockResult } from '../../supabase/libraryLock';
import {
  readSupabaseLibrary,
  readSupabaseProjectReferences,
  compareLibraries,
  buildSupabaseLibraryBackup,
  replaceSupabaseLibrary,
  type LibraryComparison,
  type SupabaseLibraryState,
  type SupabaseLibraryBackup,
  type LibReplaceResult,
} from './libraryMigration';
import {
  KOBE_PROJECT_NAME,
  analyzeKobe,
  buildUnresolvedRows,
  unresolvedToJson,
  unresolvedToCsv,
  readKobeCloudGates,
  evaluateKobeGates,
  importKobeProject,
  type KobePreflight,
  type KobeCloudGates,
  type KobeImportResult,
} from './kobeMigration';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import { storageProviderName } from '../../storage';

/** 표시용 마스킹: 앞 4자 + 자릿수(uid/토큰/긴 id 노출 방지). */
const mask4 = (s?: string | null): string => (typeof s === 'string' && s.length > 4 ? `${s.slice(0, 4)}***(${s.length}자)` : s ? '***' : '—');

const ENABLED = import.meta.env.VITE_ENABLE_MIGRATION_TOOL === 'true';
const TRIAL_PROJECT_NAME = '베페 부스_2';
const EXPECTED = { projects: 2, fixtures: 13, assets: 36, shares: 1, glb: 2 };

function ts(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export default function MigrationPage() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fbUser, setFbUser] = useState<{ uidTail: string; emailDomain: string | null } | null>(null);
  const [read, setRead] = useState<FirestoreReadResult | null>(null);
  const [backup, setBackup] = useState<FirebaseBackup | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [comparison, setComparison] = useState<ImportComparison | null>(null);
  const [targetUser, setTargetUser] = useState<SupabaseUserCheck | null>(null);
  // ⑥⑦⑧ 라이브러리 이전
  const [supaLib, setSupaLib] = useState<SupabaseLibraryState | null>(null);
  const [libCmp, setLibCmp] = useState<LibraryComparison | null>(null);
  const [libBackup, setLibBackup] = useState<SupabaseLibraryBackup | null>(null);
  const [libBackupDownloaded, setLibBackupDownloaded] = useState(false);
  const [libConfirmOpen, setLibConfirmOpen] = useState(false);
  const [libReplaceResult, setLibReplaceResult] = useState<LibReplaceResult | null>(null);
  // ⑨ 시드 잠금
  const [currentSeedLocked, setCurrentSeedLocked] = useState<boolean | null>(null);
  const [seedLockResult, setSeedLockResult] = useState<SeedLockResult | null>(null);
  const [seedLockConfirmOpen, setSeedLockConfirmOpen] = useState(false);
  // ⑩ 7월 코베 베페 안전 이전
  const [kobePre, setKobePre] = useState<KobePreflight | null>(null);
  const [kobeCloud, setKobeCloud] = useState<KobeCloudGates | null>(null);
  const [kobeListDownloaded, setKobeListDownloaded] = useState(false);
  const [kobeReactivateShare, setKobeReactivateShare] = useState(true); // 기본 체크: 로그인 없는 보기 전용 재활성화
  const [kobeConfirmOpen, setKobeConfirmOpen] = useState(false);
  const [kobeResult, setKobeResult] = useState<KobeImportResult | null>(null);

  const selectedProject: Project | null = useMemo(
    () => read?.projects.find((p) => p.id === selectedId) ?? null,
    [read, selectedId],
  );
  // ⑩ Kobe 프로젝트 참조 — hooks 규칙상 조기 return(!ENABLED) 이전에 선언.
  const kobeProject: Project | null = useMemo(
    () => read?.projects.find((p) => p.name === KOBE_PROJECT_NAME) ?? null,
    [read],
  );

  if (!ENABLED) {
    return (
      <Center>
        <Alert severity="warning" sx={{ maxWidth: 560 }}>
          <b>이전 도구가 비활성화되어 있습니다.</b>
          <br />
          로컬 전용 도구입니다. 활성화하려면 <code>.env</code> 에 <code>VITE_ENABLE_MIGRATION_TOOL=true</code> 를 설정하고 dev 서버를 재시작하세요.
          <br />
          (production 빌드에서는 기본 비활성 <code>false</code> 로 두어야 합니다.)
        </Alert>
      </Center>
    );
  }

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error)?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  const doLogin = () =>
    wrap(async () => {
      setFbUser(await signInFirebaseReadOnly());
    });

  const doRead = () =>
    wrap(async () => {
      const r = await readFirestoreData();
      setRead(r);
      const trial = r.projects.find((p) => p.name === TRIAL_PROJECT_NAME);
      setSelectedId(trial?.id ?? r.projects[0]?.id ?? '');
      setTargetUser(await checkSupabaseTargetUser());
    });

  const doCheckTarget = () =>
    wrap(async () => {
      setTargetUser(await checkSupabaseTargetUser());
    });

  const doBuildBackup = () =>
    wrap(async () => {
      if (!read) return;
      const b = await buildBackup(read, new Date().toISOString());
      const v = await validateBackup(b);
      setBackup(b);
      setValidation(v);
    });

  const doDownload = () => {
    if (!backup) return;
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `booth-planner-firebase-backup-${ts()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const doImport = () =>
    wrap(async () => {
      setConfirmOpen(false);
      if (!selectedProject) return;
      const res = await importProjectToSupabase(selectedProject);
      setImportResult(res);
      setTargetUser(await checkSupabaseTargetUser());
      if (res.status === 'success' || res.status === 'skipped') {
        setComparison(await compareImported(selectedProject));
      }
    });

  // ⑥ 라이브러리 비교 (Firebase read 필요)
  const doCompareLib = () =>
    wrap(async () => {
      if (!read) throw new Error('먼저 ② 데이터 조회로 Firebase 라이브러리를 읽어주세요.');
      const sl = await readSupabaseLibrary();
      const { refs: targetRefs } = await readSupabaseProjectReferences(); // 이전 대상(현재 Supabase 프로젝트) 참조
      setSupaLib(sl);
      setLibCmp(
        compareLibraries(
          { fixtures: read.fixtures, assets: read.assets, projects: read.projects },
          { fixtures: sl.fixtures, assets: sl.assets },
          targetRefs,
        ),
      );
      setTargetUser(sl.userCheck);
    });

  // ⑦ 현재 Supabase 라이브러리 백업 다운로드
  const doDownloadLibBackup = () =>
    wrap(async () => {
      if (!supaLib) return;
      const b = await buildSupabaseLibraryBackup(supaLib, new Date().toISOString());
      setLibBackup(b);
      const blob = new Blob([JSON.stringify(b, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `booth-planner-supabase-library-backup-${ts()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLibBackupDownloaded(true);
    });

  // ⑧ Firebase 라이브러리로 교체 (사용자 확인창 후에만)
  const doReplaceLib = () =>
    wrap(async () => {
      setLibConfirmOpen(false);
      if (!read) return;
      const res = await replaceSupabaseLibrary(read.fixtures, read.assets);
      setLibReplaceResult(res);
      // 갱신된 라이브러리 상태 재조회
      setSupaLib(await readSupabaseLibrary());
    });

  // 최종 교체 판정(스코프: 이전 대상 프로젝트). 백업/실행 게이트와 분리.
  const libEligible =
    !!libCmp &&
    !!targetUser?.ok &&
    libCmp.supabaseIsSeedOnly &&
    libCmp.jsonSerializable &&
    libCmp.unresolvedTargetAfter.length === 0;
  const libBlockReason = !libCmp
    ? '먼저 ⑥ 비교를 실행하세요.'
    : !targetUser?.ok
      ? 'Supabase Google 로그인이 확인되지 않았습니다(비익명 + 세션 일치).'
      : !libCmp.supabaseIsSeedOnly
        ? `현재 Supabase 라이브러리에 기본 시드가 아닌 항목(fix ${libCmp.supabaseNonSeedFixtures}, ass ${libCmp.supabaseNonSeedAssets})이 있습니다.`
        : libCmp.unresolvedTargetAfter.length > 0
          ? `이전 대상 프로젝트에 교체 후에도 미해결 참조 ${libCmp.unresolvedTargetAfter.length}개가 있습니다.`
          : !libCmp.jsonSerializable
            ? 'Firebase 라이브러리 JSON 직렬화 실패.'
            : '';
  const canReplaceLib = ENABLED && libEligible && libBackupDownloaded && !busy;

  // ⑨ 시드 잠금 상태 조회 / 적용
  const doCheckSeedLock = () =>
    wrap(async () => {
      const sl = await readSupabaseLibrary();
      setSupaLib(sl);
      setTargetUser(sl.userCheck);
      setCurrentSeedLocked(await isLibrarySeedLocked());
    });

  const doSetSeedLock = () =>
    wrap(async () => {
      setSeedLockConfirmOpen(false);
      const res = await setLibrarySeedLocked();
      setSeedLockResult(res);
      setCurrentSeedLocked(await isLibrarySeedLocked());
      setSupaLib(await readSupabaseLibrary());
    });

  // ⑨ 잠금 적용 조건: Google 계정 + 현재 라이브러리 13/36(교체 완료)
  const canSetSeedLock =
    ENABLED && !!targetUser?.ok && supaLib?.fixtures.length === 13 && supaLib?.assets.length === 36 && currentSeedLocked !== true && !busy;

  // ⑩ 7월 코베 베페 안전 이전 (kobeProject 는 위에서 hooks 규칙 준수 위해 선언됨)
  const doAnalyzeKobe = () =>
    wrap(async () => {
      if (!read) throw new Error('먼저 ② 데이터 조회로 Firebase 프로젝트/라이브러리를 읽어주세요.');
      const pre = await analyzeKobe(read.projects, read.fixtures);
      setKobePre(pre);
      setTargetUser(await checkSupabaseTargetUser());
      setKobeCloud(await readKobeCloudGates(pre.projectId));
    });

  const doRefreshKobeGates = () =>
    wrap(async () => {
      setTargetUser(await checkSupabaseTargetUser());
      setKobeCloud(await readKobeCloudGates(kobePre?.projectId ?? kobeProject?.id ?? null));
    });

  const downloadText = (text: string, filename: string, mime: string) => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const doDownloadKobeJson = () => {
    if (!kobeProject || !read) return;
    const rows = buildUnresolvedRows(kobeProject, read.fixtures);
    downloadText(unresolvedToJson(rows), `kobe-unresolved-fixtures-${ts()}.json`, 'application/json');
    setKobeListDownloaded(true);
  };

  const doDownloadKobeCsv = () => {
    if (!kobeProject || !read) return;
    const rows = buildUnresolvedRows(kobeProject, read.fixtures);
    downloadText(unresolvedToCsv(rows), `kobe-unresolved-fixtures-${ts()}.csv`, 'text/csv');
    setKobeListDownloaded(true);
  };

  const doImportKobe = () =>
    wrap(async () => {
      setKobeConfirmOpen(false);
      if (!kobeProject || !read) return;
      const res = await importKobeProject(kobeProject, read.fixtures, { reactivateShareView: kobeReactivateShare });
      setKobeResult(res);
      // 실행 후 게이트/대상 계정 재조회(동일 id 존재 반영 등)
      setTargetUser(await checkSupabaseTargetUser());
      setKobeCloud(await readKobeCloudGates(kobeProject.id));
    });

  const kobeGate = evaluateKobeGates({
    preflight: kobePre,
    cloud: kobeCloud,
    targetUser,
    backupDownloaded: downloaded,
    unresolvedListDownloaded: kobeListDownloaded,
    busy,
  });
  const canImportKobe = ENABLED && kobeGate.canImport;
  // 두 준비 상태 구분
  const kobeProjectReady = canImportKobe; // 프로젝트 이전 준비 완료
  const kobeShareReady = canImportKobe && kobeReactivateShare && !!kobePre?.hasShareId; // 보기 전용 공유 링크 재활성화 준비 완료

  const readCounts = read
    ? {
        projects: read.projects.length,
        fixtures: read.fixtures.length,
        assets: read.assets.length,
        shares: read.shares.length,
        glb: [...new Set([read.projects, read.fixtures, read.assets].flatMap((o) => [...JSON.stringify(o).matchAll(/"localModelId"\s*:\s*"([^"]+)"/g)].map((m) => m[1])))].length,
      }
    : null;
  const mismatch = readCounts
    ? Object.entries(EXPECTED).filter(([k, v]) => (readCounts as Record<string, number>)[k] !== v)
    : [];

  const canImport = ENABLED && !!selectedProject && !!validation?.ok && downloaded && !!targetUser?.ok && !busy;

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Firestore → Supabase 이전 (로컬 전용)
      </Typography>
      <Alert severity="error" sx={{ mb: 2 }}>
        ⚠️ 로컬 전용 도구입니다. production 에 노출/활성화하지 마세요. Firebase 원본은 <b>절대 변경하지 않습니다(읽기 전용)</b>.
        현재 저장소 provider: <b>{storageProviderName}</b>
      </Alert>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      {/* ① Firebase 연결 */}
      <Section title="① Firebase 연결 (읽기 전용)">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          기존 Firebase Google 계정으로 로그인합니다. 익명 생성·계정 연결·쓰기 없이 <b>읽기 전용</b>으로만 사용합니다.
        </Typography>
        {fbUser ? (
          <Chip color="success" icon={<CheckCircleRoundedIcon />} label={`로그인됨 (uid ${fbUser.uidTail})`} />
        ) : (
          <Button variant="contained" onClick={doLogin} disabled={busy}>
            Firebase Google 로그인
          </Button>
        )}
      </Section>

      {/* ② 데이터 조회 */}
      <Section title="② 데이터 조회 (owner 전용)">
        <Button variant="outlined" onClick={doRead} disabled={!fbUser || busy} sx={{ mb: 1 }}>
          내 프로젝트/라이브러리 조회
        </Button>
        {readCounts && (
          <Stack spacing={0.5}>
            <Typography variant="body2">프로젝트 <b>{readCounts.projects}개</b>: {read!.projects.map((p) => p.name).join(', ')}</Typography>
            <Typography variant="body2">fixtures <b>{readCounts.fixtures}</b> · assets <b>{readCounts.assets}</b> · 공유 <b>{readCounts.shares}</b> · GLB 재등록 필요 <b>{readCounts.glb}</b></Typography>
            {mismatch.length > 0 ? (
              <Alert severity="warning">조사 결과와 다른 값: {mismatch.map(([k, v]) => `${k}(예상 ${v})`).join(', ')} — 데이터가 변경됐을 수 있습니다.</Alert>
            ) : (
              <Alert severity="success">조사 결과와 일치</Alert>
            )}
          </Stack>
        )}
      </Section>

      {/* ③ 백업 생성 */}
      <Section title="③ 백업 생성 · 검증 · 다운로드">
        <Button variant="outlined" onClick={doBuildBackup} disabled={!read || busy} sx={{ mb: 1 }}>
          백업 JSON 생성 + 무결성 검증
        </Button>
        {validation && (
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            {validation.checks.map((c) => (
              <Typography key={c.name} variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {c.pass ? <CheckCircleRoundedIcon color="success" fontSize="small" /> : <ErrorRoundedIcon color="error" fontSize="small" />}
                {c.name}: {c.detail}
              </Typography>
            ))}
            <Typography variant="body2" color="text.secondary">예상 백업 크기 ≈ {Math.round(validation.estimatedBytes / 1024)} KB · 체크섬(SHA-256): {backup?.integrity.checksum.slice(0, 12)}…</Typography>
            {validation.warnings.map((w) => (
              <Alert key={w} severity="warning">{w}</Alert>
            ))}
          </Stack>
        )}
        {backup && (
          <Button variant="contained" color={downloaded ? 'success' : 'primary'} onClick={doDownload}>
            {downloaded ? '백업 다시 다운로드' : '백업 JSON 다운로드'}
          </Button>
        )}
        {downloaded && <Chip sx={{ ml: 1 }} color="success" size="small" label="다운로드 완료" />}
        {backup && !downloaded && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            ※ 백업을 <b>다운로드해야</b> 시험 이전 버튼이 활성화됩니다.
          </Typography>
        )}
      </Section>

      {/* ④ 시험 이전 */}
      <Section title="④ 시험 이전 (프로젝트 1개만)">
        <Alert severity="info" sx={{ mb: 1 }}>
          프로젝트 <b>1개만</b> Supabase 로 이전합니다. fixtures/assets 는 이번 시험에서 <b>제외</b>. <b>Firebase 원본은 유지</b>됩니다.
          동일 id 가 있으면 <b>skip</b>(덮어쓰기 없음).
        </Alert>

        {/* 저장 대상 Supabase 계정(소유권) 검증 */}
        <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: targetUser?.ok ? 'success.50' : 'warning.50' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>저장 대상 계정:</Typography>
            <Chip
              size="small"
              color={targetUser?.ok ? 'success' : 'default'}
              icon={targetUser?.ok ? <CheckCircleRoundedIcon /> : <ErrorRoundedIcon />}
              label={targetUser ? (targetUser.isAnonymous ? '게스트(익명)' : targetUser.google ? 'Google 로그인됨' : '비-Google') : '미확인'}
            />
            {targetUser?.uidTail && <Chip size="small" variant="outlined" label={`uid ${targetUser.uidTail}`} />}
            {targetUser?.ok && <Chip size="small" color="success" variant="outlined" label="대상 계정 확인됨" />}
            <Button size="small" onClick={doCheckTarget} disabled={busy}>다시 확인</Button>
          </Stack>
          {targetUser && !targetUser.ok && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Supabase Google 로그인이 확인되지 않아 이전을 중단합니다({targetUser.reason}). 헤더에서 <b>기존 Google 계정으로 다시 로그인</b>한 뒤 다시 확인해 주세요.
            </Alert>
          )}
        </Paper>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <Typography variant="body2">대상:</Typography>
          <Select size="small" value={selectedId} onChange={(e) => setSelectedId(e.target.value)} disabled={!read || busy} sx={{ minWidth: 200 }}>
            {read?.projects.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.name}
                {p.name === TRIAL_PROJECT_NAME ? ' (추천)' : ''}
              </MenuItem>
            ))}
          </Select>
        </Stack>
        <Button variant="contained" color="warning" disabled={!canImport} onClick={() => setConfirmOpen(true)}>
          이 프로젝트 1개 Supabase 로 이전
        </Button>
        {!downloaded && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>백업 다운로드 후 활성화됩니다.</Typography>}
      </Section>

      {/* ⑤ 결과 */}
      {importResult && (
        <Section title="⑤ 결과">
          <Alert severity={importResult.status === 'success' ? 'success' : importResult.status === 'skipped' ? 'info' : 'error'}>
            <b>{importResult.status.toUpperCase()}</b> — {importResult.name} (id {importResult.id.slice(0, 8)}…)
            {importResult.reason ? ` · ${importResult.reason}` : ''}
          </Alert>
          {comparison && (
            <Stack spacing={0.3} sx={{ mt: 1 }}>
              <Typography variant="body2">Firebase 원본 프로젝트 수: {read?.projects.length} (원본 그대로 유지, 읽기만 함)</Typography>
              <Typography variant="body2">Supabase 조회: {comparison.found ? '있음' : '없음'} · 이름일치 {String(comparison.nameMatch)} · layouts {comparison.detail} · createdAt {String(comparison.createdAtMatch)} · updatedAt {String(comparison.updatedAtMatch)} · boothConfig {String(comparison.boothConfigPresent)}</Typography>
            </Stack>
          )}
        </Section>
      )}

      {/* ⑥ 라이브러리 비교 */}
      <Section title="⑥ 라이브러리 비교 (fixtures/assets)">
        <Button variant="outlined" onClick={doCompareLib} disabled={!read || busy} sx={{ mb: 1 }}>
          Firebase ↔ Supabase 라이브러리 비교
        </Button>
        {!read && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>먼저 ② 데이터 조회 필요</Typography>}
        {libCmp && (
          <Stack spacing={0.5}>
            <Typography variant="body2">Firebase: fixtures <b>{libCmp.firebase.fixtures}</b> / assets <b>{libCmp.firebase.assets}</b></Typography>
            <Typography variant="body2">현재 Supabase: fixtures <b>{libCmp.supabase.fixtures}</b> / assets <b>{libCmp.supabase.assets}</b></Typography>
            <Typography variant="body2">동일 id — fix {libCmp.fixtureBothIds}, ass {libCmp.assetBothIds} / 내용다른 동일id — fix {libCmp.fixtureSameIdDiffContent}, ass {libCmp.assetSameIdDiffContent}</Typography>
            <Typography variant="body2">Firebase에만 — fix {libCmp.fixtureFirebaseOnly}, ass {libCmp.assetFirebaseOnly} · Supabase에만 — fix {libCmp.fixtureSupabaseOnly}, ass {libCmp.assetSupabaseOnly} · 이름중복(FB) {libCmp.firebaseNameDups}</Typography>
            <Typography variant="body2"><b>이전 대상 프로젝트</b> 참조 {libCmp.targetProjectReferences.length}개 · 현재 미해결 <b>{libCmp.unresolvedTargetBefore.length}</b> · 교체 후 미해결 <b>{libCmp.unresolvedTargetAfter.length}</b></Typography>
            <Typography variant="body2">dataURL 에셋 {libCmp.dataUrlAssetCount}개 · 예상 {Math.round(libCmp.estAssetBytes / 1024)}KB · GLB {libCmp.localModelIdItems}개 · 직렬화 {String(libCmp.jsonSerializable)}</Typography>

            {/* 최종 판정 배지 (일원화) */}
            {libEligible ? (
              <Alert severity="success">
                <b>교체 대상 적합</b> — 이전 대상(현재 Supabase 프로젝트)의 참조가 교체 후 모두 해결됩니다. {libBackupDownloaded ? '실행 가능(⑧).' : '⑦ 백업 다운로드 후 실행 가능합니다.'}
              </Alert>
            ) : (
              <Alert severity="error"><b>교체 불가</b> — {libBlockReason}</Alert>
            )}

            {/* Firebase 원본 댕글링 (교체 차단에서 제외, 별도 경고) */}
            {libCmp.sourceDanglingByProject.length > 0 && (
              <Alert severity="warning">
                Firebase 원본에 정의가 유실된 집기 참조(댕글링): {libCmp.sourceDanglingByProject.map((d) => `‘${d.name}’ ${d.count}개`).join(', ')}.
                <br />해당 프로젝트는 아직 이전 대상이 아니며, 이번 베페 부스_2 라이브러리 교체를 <b>차단하지 않습니다</b>. 해당 프로젝트 이전 전에 <b>수동 복구</b>가 필요합니다.
              </Alert>
            )}
            <Alert severity="info">GLB(localModelId) {libCmp.localModelIdItems}개는 데이터상 보존되지만 IndexedDB 실파일은 없어 대상 기기에서 <b>재등록 필요</b>.</Alert>
          </Stack>
        )}
      </Section>

      {/* ⑦ Supabase 라이브러리 백업 */}
      <Section title="⑦ 현재 Supabase 라이브러리 백업 다운로드">
        <Button variant="contained" color={libBackupDownloaded ? 'success' : 'primary'} onClick={doDownloadLibBackup} disabled={!supaLib || busy}>
          {libBackupDownloaded ? '라이브러리 백업 다시 다운로드' : 'Supabase 라이브러리 백업 다운로드'}
        </Button>
        {libBackupDownloaded && <Chip sx={{ ml: 1 }} size="small" color="success" label="다운로드 완료" />}
        {libBackup && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            체크섬(SHA-256): {libBackup.integrity.checksum.slice(0, 12)}… · fixtures {libBackup.fixtures.length} / assets {libBackup.assets.length}
          </Typography>
        )}
        {!libBackupDownloaded && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>※ 백업을 다운로드해야 교체 버튼이 활성화됩니다.</Typography>}
      </Section>

      {/* ⑧ 라이브러리 교체 */}
      <Section title="⑧ Firebase 라이브러리로 교체">
        <Alert severity="warning" sx={{ mb: 1 }}>
          현재 Supabase 라이브러리를 <b>Firebase 라이브러리 전체로 교체</b>합니다(fixtures {libCmp?.firebase.fixtures ?? '?'} / assets {libCmp?.firebase.assets ?? '?'}). id 보존, 한 번의 원자적 저장.
          <br />기본 시드는 Firebase 라이브러리로 <b>교체(제거)</b>됩니다. <b>Firebase 원본은 유지</b>. GLB {libCmp?.localModelIdItems ?? 2}개는 재등록 필요.
          <br />저장 대상: {targetUser?.ok ? <b>Google 로그인됨 (uid {targetUser.uidTail})</b> : <b>미확인 — 헤더에서 Google 로그인 필요</b>}
        </Alert>
        <Button variant="contained" color="warning" disabled={!canReplaceLib} onClick={() => setLibConfirmOpen(true)}>
          라이브러리 교체 실행
        </Button>
        {!canReplaceLib && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            활성화 조건: ⑥ 비교(기본 시드만 + 교체 후 미해결 0) · ⑦ 백업 다운로드 · Google 로그인 확인.
          </Typography>
        )}
        {libReplaceResult && (
          <Alert
            severity={libReplaceResult.status === 'success' ? 'success' : 'error'}
            sx={{ mt: 1.5 }}
          >
            <b>{libReplaceResult.status.toUpperCase()}</b>{libReplaceResult.reason ? ` — ${libReplaceResult.reason}` : ''}
            {libReplaceResult.verify && (
              <>
                <br />검증: fixtures {libReplaceResult.verify.fixtures} · assets {libReplaceResult.verify.assets} · id일치 {String(libReplaceResult.verify.idSetsMatch)} · dataURL일치 {String(libReplaceResult.verify.dataUrlAssetsMatch)} · 소유 {libReplaceResult.verify.ownerTail} · 참조해결 {String(libReplaceResult.verify.referencedResolved)} · projects유지 {String(libReplaceResult.verify.projectsUnchanged)} · shares유지 {String(libReplaceResult.verify.sharesUnchanged)}
              </>
            )}
          </Alert>
        )}
      </Section>

      {/* ⑨ 시드 잠금 적용 */}
      <Section title="⑨ 시드 잠금 적용 (기본 시드 재추가 방지)">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          클라우드에 <code>seed_locked=true</code>를 저장해 다른 기기·새 브라우저·시크릿·데이터삭제·SEED_VERSION 증가 상황에서도 기본 시드가 다시 추가되지 않게 합니다. (<b>002 SQL 적용 후</b> 사용)
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" onClick={doCheckSeedLock} disabled={busy}>현재 잠금 상태 확인</Button>
          {currentSeedLocked !== null && (
            <Chip
              size="small"
              color={currentSeedLocked ? 'success' : 'default'}
              icon={currentSeedLocked ? <CheckCircleRoundedIcon /> : <ErrorRoundedIcon />}
              label={currentSeedLocked ? 'seed_locked = true' : 'seed_locked = false / 미적용'}
            />
          )}
          {supaLib && <Chip size="small" variant="outlined" label={`현재 라이브러리 fix ${supaLib.fixtures.length}/ass ${supaLib.assets.length}`} />}
        </Stack>
        <Button variant="contained" color="warning" disabled={!canSetSeedLock} onClick={() => setSeedLockConfirmOpen(true)}>
          현재 이전된 라이브러리에 시드 잠금 적용
        </Button>
        {currentSeedLocked === true && <Chip sx={{ ml: 1 }} size="small" color="success" label="이미 잠금됨" />}
        {!canSetSeedLock && currentSeedLocked !== true && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            조건: Google 로그인 확인 + 현재 라이브러리 13/36(교체 완료). 먼저 “현재 잠금 상태 확인”을 눌러주세요.
          </Typography>
        )}
        {seedLockResult && (
          <Alert severity={seedLockResult.status === 'success' ? 'success' : 'error'} sx={{ mt: 1.5 }}>
            <b>{seedLockResult.status.toUpperCase()}</b>{seedLockResult.reason ? ` — ${seedLockResult.reason}` : ''}
            {seedLockResult.status === 'success' ? ` · seed_locked=true (uid ${seedLockResult.userTail})` : ''}
          </Alert>
        )}
      </Section>

      {/* ⑩ 7월 코베 베페 안전 이전 */}
      <Section title="⑩ 7월 코베 베페 안전 이전">
        <Alert severity="error" sx={{ mb: 1.5 }}>
          이 섹션은 <b>{KOBE_PROJECT_NAME}</b> 프로젝트 1개만 안전하게 이전합니다. Firebase 원본·백업 JSON 은 변경하지 않으며,
          정의가 유실된 집기 <b>6개</b>는 <b>추측 복구/삭제하지 않고</b> 배치 기록만 보존합니다. 실제 쓰기는 최종 확인 버튼을 눌러야만 실행됩니다.
        </Alert>

        <Button variant="outlined" onClick={doAnalyzeKobe} disabled={!read || busy} sx={{ mb: 1 }}>
          프리플라이트 분석 / 게이트 조회
        </Button>
        {!read && <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>먼저 ② 데이터 조회 필요</Typography>}

        {kobePre && !kobePre.found && (
          <Alert severity="warning" sx={{ mt: 1 }}>로드된 Firebase 데이터에서 <b>{KOBE_PROJECT_NAME}</b> 를 찾지 못했습니다.</Alert>
        )}

        {kobePre?.found && (
          <>
            {/* 프리플라이트 정보(마스킹) */}
            <Paper variant="outlined" sx={{ p: 1.5, my: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>프리플라이트</Typography>
              <Stack spacing={0.3}>
                <Typography variant="body2">project id(마스킹): <code>{mask4(kobePre.projectId)}</code> · 공유 토큰: <code>{kobePre.hasShareId ? '보존됨(마스킹·미표시)' : '없음'}</code></Typography>
                <Typography variant="body2">layouts <b>{kobePre.layoutCount}</b> · placedFixtures <b>{kobePre.placedFixtureCount}</b> · 정상 해결 집기 <b>{kobePre.resolvedFixtureCount}</b> · <span style={{ color: '#c62828' }}>정의 유실 집기 <b>{kobePre.unresolvedFixtureCount}</b></span></Typography>
                <Typography variant="body2">designAssets <b>{kobePre.designAssetCount}</b> · products <b>{kobePre.productCount}</b> · VMD board <b>{kobePre.vmdBoardCount}</b> · GLB <b>{kobePre.glbCount}</b></Typography>
                <Typography variant="body2">예상 크기 ≈ <b>{Math.round(kobePre.approxBytes / 1024)}KB</b> · 직렬화 <b>{String(kobePre.serializable)}</b> · 체크섬(SHA-256) <code>{kobePre.checksumHex ? kobePre.checksumHex.slice(0, 12) + '…' : '계산 실패'}</code> · dataURL {String(kobePre.hasDataUrl)}</Typography>
                <Typography variant="body2">원본 공유: shareEnabled <b>{String(kobePre.shareEnabled)}</b> · 원본 sharePermission <b>{kobePre.sharePermissionOriginal ?? '—'}</b></Typography>
              </Stack>
              <Alert severity="warning" sx={{ mt: 1 }}>
                유실 <b>{kobePre.unresolvedFixtureCount}개</b>는 <b>Firebase 원본에서도 정의가 없습니다</b>. 이전 후 배치 기록(fixtureDefId/좌표/회전)은 보존되지만 <b>화면에는 표시되지 않습니다</b>(크래시 없음).
              </Alert>
            </Paper>

            {/* 유실 목록 다운로드 */}
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>유실 {kobePre.unresolvedFixtureCount}개 목록:</Typography>
              <Button size="small" variant="contained" color={kobeListDownloaded ? 'success' : 'primary'} onClick={doDownloadKobeJson}>JSON 다운로드</Button>
              <Button size="small" variant="outlined" onClick={doDownloadKobeCsv}>CSV 다운로드</Button>
              {kobeListDownloaded && <Chip size="small" color="success" label="다운로드 완료" />}
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              ※ 목록에는 fixtureDefId/layoutId/placedFixtureId/좌표/회전/localFixtures·Firebase library 존재여부만 포함(uid·email·share token 미포함). 목록 다운로드가 게이트 조건입니다.
            </Typography>

            {/* 공유 정책 체크박스 */}
            <FormControlLabel
              control={<Checkbox checked={kobeReactivateShare} onChange={(e) => setKobeReactivateShare(e.target.checked)} />}
              label={<Typography variant="body2">기존 링크를 <b>로그인 없는 보기 전용(view)</b>으로 재활성화 (shareId 토큰 보존, project_shares.permission=view)</Typography>}
            />
            <Alert severity="info" sx={{ mb: 1.5 }}>
              원본 sharePermission 이 <b>{kobePre.sharePermissionOriginal ?? '—'}</b> 이어도 공개 편집 권한은 부여하지 않습니다. project_shares 에는 <b>항상 view</b> 로만 저장하며, layout_data 내부 sharePermission 원본값은 <b>변경하지 않습니다</b>(원본 보존). 익명 편집 기능은 이번 범위 아님.
            </Alert>

            {/* 게이트 상태 */}
            <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, bgcolor: canImportKobe ? 'success.50' : 'grey.50' }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap' }}>
                <Chip size="small" color={kobeProjectReady ? 'success' : 'default'} icon={kobeProjectReady ? <CheckCircleRoundedIcon /> : <ErrorRoundedIcon />} label="프로젝트 이전 준비 완료" />
                <Chip size="small" color={kobeShareReady ? 'success' : 'default'} variant={kobeShareReady ? 'filled' : 'outlined'} label="보기 전용 공유 링크 재활성화 준비 완료" />
                <Button size="small" onClick={doRefreshKobeGates} disabled={busy}>게이트 재확인</Button>
              </Stack>
              <Stack spacing={0.2}>
                <Typography variant="caption">백업 다운로드(③): {String(downloaded)} · 유실목록 다운로드: {String(kobeListDownloaded)} · Google 사용자: {String(!!targetUser?.ok)}</Typography>
                <Typography variant="caption">seed_locked: {String(kobeCloud?.seedLocked ?? '—')} · user_libraries: {kobeCloud ? `${kobeCloud.libFixtures}/${kobeCloud.libAssets}` : '—'} · 동일 id 존재: {String(kobeCloud?.idExists ?? '—')}</Typography>
              </Stack>
              {!canImportKobe && (
                <Alert severity="warning" sx={{ mt: 1 }}>
                  <b>이전 불가</b> — {kobeGate.firstReason}
                  {kobeGate.reasons.length > 1 && <> (외 {kobeGate.reasons.length - 1}건)</>}
                </Alert>
              )}
            </Paper>

            <Button variant="contained" color="warning" disabled={!canImportKobe} onClick={() => setKobeConfirmOpen(true)}>
              7월 코베 베페 이전 실행
            </Button>

            {kobeResult && (
              <Alert
                severity={kobeResult.status === 'success' ? 'success' : kobeResult.status === 'skipped_existing' ? 'info' : kobeResult.status === 'project_imported_share_failed' ? 'warning' : 'error'}
                sx={{ mt: 1.5 }}
              >
                <b>{kobeResult.status.toUpperCase()}</b>{kobeResult.reason ? ` — ${kobeResult.reason}` : ''}
                <br />공유 처리: <b>{kobeResult.shareOutcome}</b>{kobeResult.sharePermissionStored ? ` (permission=${kobeResult.sharePermissionStored})` : ''}{typeof kobeResult.shareRpcResolved === 'boolean' ? ` · 익명 RPC 조회 ${String(kobeResult.shareRpcResolved)}` : ''}{kobeResult.shareReason ? ` · ${kobeResult.shareReason}` : ''}
                {kobeResult.projectVerify && (
                  <>
                    <br />검증: id {String(kobeResult.projectVerify.idMatch)} · name {String(kobeResult.projectVerify.nameMatch)} · layouts {String(kobeResult.projectVerify.layoutCountMatch)} · created {String(kobeResult.projectVerify.createdAtMatch)} · updated {String(kobeResult.projectVerify.updatedAtMatch)} · booth {String(kobeResult.projectVerify.boothConfigPresent)}
                    <br />designAssets {String(kobeResult.projectVerify.designAssetsMatch)} · products {String(kobeResult.projectVerify.productsMatch)} · vmd {String(kobeResult.projectVerify.vmdBoardsMatch)} · placed {String(kobeResult.projectVerify.placedFixturesMatch)} · 해결6 {String(kobeResult.projectVerify.resolvedMatch)} · 유실6 {String(kobeResult.projectVerify.unresolvedMatch)} · 유실geom {String(kobeResult.projectVerify.unresolvedGeometryMatch)}
                    <br />shareFields 원본보존 {String(kobeResult.projectVerify.shareFieldsMatch)} · seed_locked {String(kobeResult.projectVerify.seedLockedStillTrue)} · 라이브러리13/36 {String(kobeResult.projectVerify.libraryUnchanged)} · 기존행 불변 {String(kobeResult.projectVerify.otherProjectUnchanged)}
                  </>
                )}
              </Alert>
            )}
          </>
        )}
      </Section>

      <Dialog open={kobeConfirmOpen} onClose={() => setKobeConfirmOpen(false)}>
        <DialogTitle>7월 코베 베페 이전 확인</DialogTitle>
        <DialogContent>
          <Typography variant="body2" component="div">
            <b>{KOBE_PROJECT_NAME}</b> 프로젝트 1개를 현재 Supabase Google 계정(uid {targetUser?.uidTail})으로 이전합니다.
            <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
              <li>Firebase 원본은 <b>유지</b>됩니다(읽기 전용).</li>
              <li>정의 유실 집기 <b>6개</b> 기록은 <b>보존</b>되지만 화면에는 <b>표시되지 않습니다</b>.</li>
              <li>정상 데이터·이미지(designAssets)·VMD·products 는 그대로 이전됩니다.</li>
              <li>공유 링크는 {kobeReactivateShare ? <b>선택됨 → 로그인 없는 보기 전용(view)으로 재활성화</b> : <b>미선택 → 프로젝트만 이전(링크 비활성)</b>}됩니다. {kobeReactivateShare && '(원본 permission 과 무관하게 view 로만 저장)'}</li>
              <li>실행 후 <b>자동 롤백은 없습니다</b>. 동일 id 존재 시 skip(덮어쓰기 없음).</li>
            </ul>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKobeConfirmOpen(false)} color="inherit">취소</Button>
          <Button onClick={doImportKobe} variant="contained" color="warning" disabled={busy}>7월 코베 베페 이전 실행</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={seedLockConfirmOpen} onClose={() => setSeedLockConfirmOpen(false)}>
        <DialogTitle>시드 잠금 적용 확인</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            현재 Google 계정(uid {targetUser?.uidTail})의 <code>user_libraries.seed_locked</code>를 <b>true</b>로 설정합니다.
            <br />- fixtures/assets 는 변경하지 않습니다(부분 갱신).
            <br />- 이후 모든 기기에서 앱 기본 시드/top-up 이 추가되지 않습니다.
            <br />계속하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSeedLockConfirmOpen(false)} color="inherit">취소</Button>
          <Button onClick={doSetSeedLock} variant="contained" color="warning" disabled={busy}>잠금 적용</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={libConfirmOpen} onClose={() => setLibConfirmOpen(false)}>
        <DialogTitle>라이브러리 교체 확인</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            현재 Supabase 라이브러리(기본 시드)를 <b>Firebase 라이브러리 전체</b>(fixtures {libCmp?.firebase.fixtures} / assets {libCmp?.firebase.assets})로 교체합니다.
            <br />- 저장 대상: Google 계정 (uid {targetUser?.uidTail})
            <br />- id 보존, 한 번의 원자적 저장, 저장 후 재검증
            <br />- Firebase 원본·Supabase projects·project_shares는 변경하지 않음
            <br />- 백업은 이미 다운로드됨(복원용)
            <br />계속하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLibConfirmOpen(false)} color="inherit">취소</Button>
          <Button onClick={doReplaceLib} variant="contained" color="warning" disabled={busy}>교체 실행</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>시험 이전 확인</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <b>{selectedProject?.name}</b> 프로젝트 1개를 현재 Supabase 계정으로 이전합니다.
            <br />- Firebase 원본은 변경되지 않습니다(읽기 전용).
            <br />- 동일 id 존재 시 skip(덮어쓰기 없음).
            <br />- fixtures/assets·공유는 이번에 이전하지 않습니다.
            <br />계속하시겠습니까?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} color="inherit">취소</Button>
          <Button onClick={doImport} variant="contained" color="warning" disabled={busy}>
            이전 실행
          </Button>
        </DialogActions>
      </Dialog>

      {busy && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <CircularProgress size={18} /> <Typography variant="body2">처리 중…</Typography>
        </Box>
      )}
    </Box>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
      <Divider sx={{ mb: 1.5 }} />
      {children}
    </Paper>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <Box sx={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>{children}</Box>;
}

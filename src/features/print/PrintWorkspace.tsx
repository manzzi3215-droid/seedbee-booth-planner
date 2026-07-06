import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Paper from '@mui/material/Paper';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import DataObjectRoundedIcon from '@mui/icons-material/DataObjectRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import type { BoxFace, PrintFaceSettings, PrintSettings } from '../../types';
import { useEditor } from '../editor/EditorContext';
import { BOX_FACES, resolveFaceMapping, assetById } from '../design/mapping';
import { preloadImages, downloadDataURL, sanitizeFilename } from '../export/download';
import {
  ensurePrintSettings,
  autoFaceSizeMm,
  finalPrintSizeMm,
  computeFaceDpi,
  buildManifest,
  BLEED_PRESETS,
  type DpiStatus,
} from './printSettings';
import { renderPrintFaceCanvas, pagePrintSizeMm } from './renderPrintFace';

const DPI_COLOR: Record<DpiStatus, 'success' | 'warning' | 'error' | 'default'> = {
  good: 'success',
  warn: 'warning',
  low: 'error',
  unknown: 'default',
};

/**
 * Print Production Workspace (출력물 제작) — v0.8.9.
 *
 * 실제 출력업체 전달용 작업 공간. 선택 집기의 면별 출력 사이즈/블리드/재단선/안전영역/
 * 출력용 변형을 설정하고, 면별/전체 PDF + manifest 를 생성합니다.
 * 디자인 이미지는 Design Mapping(v0.8.7) 의 에셋을 그대로 재사용합니다(재업로드 없음).
 * 화면 시안용 Mapping(PlacedFixture.design) 과 출력용 Mapping(FixtureDef.printSettings) 은 분리됩니다.
 */
export default function PrintWorkspace({
  open,
  onClose,
  initialFixtureId,
}: {
  open: boolean;
  onClose: () => void;
  initialFixtureId?: string | null;
}) {
  const { project, placed, fixturesById, designAssets, updateFixturePrintSettings } = useEditor();

  const [workingId, setWorkingId] = useState<string | null>(null);
  const [face, setFace] = useState<BoxFace>('front');
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [imageEls, setImageEls] = useState<Map<string, HTMLImageElement>>(new Map());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const settingsRef = useRef<PrintSettings | null>(null);
  settingsRef.current = settings;

  // 배치된 집기 목록 (드롭다운) — 중복 집기명은 인덱스 부여
  const fixtureOptions = useMemo(() => {
    const counts = new Map<string, number>();
    return placed.map((p) => {
      const def = fixturesById.get(p.fixtureDefId);
      const base = def?.name ?? '집기';
      const n = (counts.get(base) ?? 0) + 1;
      counts.set(base, n);
      return { id: p.id, label: n > 1 || placed.filter((q) => fixturesById.get(q.fixtureDefId)?.name === base).length > 1 ? `${base} #${n}` : base };
    });
  }, [placed, fixturesById]);

  // 진입 시 작업 집기 결정
  useEffect(() => {
    if (!open) return;
    const first = initialFixtureId && placed.some((p) => p.id === initialFixtureId)
      ? initialFixtureId
      : placed[0]?.id ?? null;
    setWorkingId(first);
    setFace('front');
  }, [open, initialFixtureId, placed]);

  const working = workingId ? placed.find((p) => p.id === workingId) ?? null : null;
  const def = working ? fixturesById.get(working.fixtureDefId) ?? null : null;

  // 작업 집기 변경 시 printSettings 로드(없으면 기본값)
  useEffect(() => {
    if (!def) {
      setSettings(null);
      return;
    }
    setSettings(ensurePrintSettings(def));
  }, [def]);

  // 이미지 preload
  useEffect(() => {
    if (!open) {
      setReady(false);
      setImageEls(new Map());
      return;
    }
    let active = true;
    setReady(false);
    (async () => {
      const els = await preloadImages(designAssets.map((a) => a.url));
      if (!active) return;
      setImageEls(els);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [open, designAssets]);

  // 현재 면의 디자인 에셋/모드/이미지 (Design Mapping 재사용)
  const resolveFace = useCallback(
    (f: BoxFace) => {
      const sm = resolveFaceMapping(working?.design, f);
      const asset = sm ? assetById(designAssets, sm.assetId) : null;
      const mode = sm?.mode ?? 'stretch';
      const image = asset ? imageEls.get(asset.url) : undefined;
      return { asset, mode, image };
    },
    [working, designAssets, imageEls],
  );

  const faceSettings: PrintFaceSettings | null = settings?.faces[face] ?? null;
  const current = resolveFace(face);
  const dpi = faceSettings ? computeFaceDpi(current.asset, faceSettings, current.mode) : null;

  // 미리보기 이미지 (dataURL)
  const previewUrl = useMemo(() => {
    if (!ready || !faceSettings) return '';
    try {
      const canvas = renderPrintFaceCanvas({
        face: faceSettings,
        image: current.image,
        mode: current.mode,
        showTrimGuide: true,
        pxPerMm: 4,
        maxDimPx: 1600,
      });
      return canvas.toDataURL('image/png');
    } catch {
      return '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, faceSettings, current.image, current.mode]);

  // ── 설정 변경 헬퍼 ──
  const patchFace = (patch: Partial<PrintFaceSettings>, persist = true) => {
    setSettings((prev) => {
      if (!prev) return prev;
      const cur = prev.faces[face] ?? null;
      if (!cur) return prev;
      const next: PrintSettings = { faces: { ...prev.faces, [face]: { ...cur, ...patch } } };
      settingsRef.current = next;
      return next;
    });
    if (persist) persistNow();
  };

  const patchTransform = (patch: Partial<PrintFaceSettings['transform']>, persist = true) => {
    const cur = settingsRef.current?.faces[face];
    if (!cur) return;
    patchFace({ transform: { ...cur.transform, ...patch } }, persist);
  };

  const persistNow = () => {
    if (def && settingsRef.current) updateFixturePrintSettings(def.id, settingsRef.current);
  };

  // ── PDF / manifest export ──
  const facePdf = async (f: BoxFace, doDownload: boolean) => {
    const fs = settingsRef.current?.faces[f];
    if (!fs || !def) return null;
    const { image, mode } = resolveFace(f);
    const canvas = renderPrintFaceCanvas({ face: fs, image, mode, showTrimGuide: false, pxPerMm: 6, maxDimPx: 4096 });
    const page = pagePrintSizeMm(fs);
    const orientation = page.widthMm >= page.heightMm ? 'landscape' : 'portrait';
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation, unit: 'mm', format: [page.widthMm, page.heightMm] });
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pw, ph);
    if (doDownload) pdf.save(`${sanitizeFilename(def.name)}_${f}.pdf`);
    return pdf;
  };

  const handleFacePdf = async () => {
    setBusy(true);
    try {
      await facePdf(face, true);
    } catch {
      setToast('PDF 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleAllPdf = async () => {
    setBusy(true);
    try {
      for (const f of BOX_FACES) {
        await facePdf(f.value, true);
        await new Promise((r) => setTimeout(r, 350)); // 순차 다운로드(브라우저 차단 방지)
      }
      setToast('모든 면 PDF 를 순차 다운로드했습니다.');
    } catch {
      setToast('전체 PDF 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleManifest = () => {
    if (!def || !project || !settingsRef.current) return;
    const dpiByFace: Partial<Record<BoxFace, number | null>> = {};
    for (const f of BOX_FACES) {
      const fs = settingsRef.current.faces[f.value];
      const r = resolveFace(f.value);
      dpiByFace[f.value] = fs ? computeFaceDpi(r.asset, fs, r.mode).dpi : null;
    }
    const manifest = buildManifest(project.name, def.name, settingsRef.current, dpiByFace);
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    downloadDataURL(url, `${sanitizeFilename(def.name)}_manifest.json`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!open) return null;

  const finalSize = faceSettings ? finalPrintSizeMm(faceSettings) : null;

  return (
    <Box sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: '#f5f7fa', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 바 */}
      <Stack direction="row" sx={{ alignItems: 'center', px: 2, py: 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', gap: 1.5 }}>
        <PictureAsPdfRoundedIcon color="secondary" />
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>출력물 제작</Typography>
        <Typography variant="caption" color="text.secondary">Print Production Workspace</Typography>
        <Box sx={{ flex: 1 }} />
        {placed.length > 0 && (
          <Select
            size="small"
            value={workingId ?? ''}
            onChange={(e) => setWorkingId(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            {fixtureOptions.map((o) => (
              <MenuItem key={o.id} value={o.id}>{o.label}</MenuItem>
            ))}
          </Select>
        )}
        <Tooltip title="닫기 (편집기로)">
          <IconButton onClick={onClose}><CloseRoundedIcon /></IconButton>
        </Tooltip>
      </Stack>

      {placed.length === 0 || !def || !faceSettings ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            배치된 집기가 없습니다. 집기를 배치한 뒤 다시 시도하세요.
          </Typography>
        </Box>
      ) : (
        <>
          {/* 면 탭 */}
          <Tabs
            value={face}
            onChange={(_, v) => setFace(v as BoxFace)}
            variant="scrollable"
            sx={{ bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', minHeight: 42 }}
          >
            {BOX_FACES.map((f) => (
              <Tab key={f.value} value={f.value} label={f.label} sx={{ minHeight: 42 }} />
            ))}
          </Tabs>

          <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
            {/* 미리보기 */}
            <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, position: 'relative' }}>
              {!ready ? (
                <CircularProgress />
              ) : previewUrl ? (
                <Box component="img" src={previewUrl} alt="print preview" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 8px 30px rgba(15,23,42,0.18)' }} />
              ) : (
                <Typography variant="body2" color="text.secondary">미리보기를 표시할 수 없습니다.</Typography>
              )}
              <Stack direction="row" spacing={1} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                <Chip size="small" variant="outlined" label={`재단 ${faceSettings.widthMm} × ${faceSettings.heightMm} mm`} />
                <Chip size="small" color="secondary" variant="outlined" label={`최종 ${finalSize?.widthMm} × ${finalSize?.heightMm} mm`} />
                {dpi && (
                  <Chip size="small" color={DPI_COLOR[dpi.status]} label={dpi.label} />
                )}
              </Stack>
            </Box>

            {/* 컨트롤 패널 */}
            <Box sx={{ width: 340, flexShrink: 0, borderLeft: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', overflowY: 'auto', p: 2 }}>
              {/* 출력 사이즈 */}
              <SectionTitle>출력 사이즈</SectionTitle>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                자동: {autoFaceSizeMm(def, face).widthMm} × {autoFaceSizeMm(def, face).heightMm} mm
              </Typography>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                <TextField
                  size="small" label="가로(mm)" type="number" value={faceSettings.widthMm}
                  onChange={(e) => patchFace({ widthMm: Math.max(1, Math.round(Number(e.target.value) || 0)) }, false)}
                  onBlur={persistNow}
                />
                <Typography variant="body2">×</Typography>
                <TextField
                  size="small" label="세로(mm)" type="number" value={faceSettings.heightMm}
                  onChange={(e) => patchFace({ heightMm: Math.max(1, Math.round(Number(e.target.value) || 0)) }, false)}
                  onBlur={persistNow}
                />
              </Stack>
              <Button size="small" startIcon={<RestartAltRoundedIcon />} onClick={() => patchFace(autoFaceSizeMm(def, face))}>
                자동 사이즈로
              </Button>

              <Divider sx={{ my: 1.5 }} />

              {/* 블리드 */}
              <SectionTitle>Bleed (도련)</SectionTitle>
              <ToggleButtonGroup
                exclusive size="small" value={BLEED_PRESETS.includes(faceSettings.bleedMm) ? faceSettings.bleedMm : null}
                onChange={(_, v) => v != null && patchFace({ bleedMm: v })}
                sx={{ mb: 1 }}
              >
                {BLEED_PRESETS.map((b) => (
                  <ToggleButton key={b} value={b} sx={{ px: 1.5 }}>{b}mm</ToggleButton>
                ))}
              </ToggleButtonGroup>
              <TextField
                size="small" label="직접 입력(mm)" type="number" value={faceSettings.bleedMm} fullWidth
                onChange={(e) => patchFace({ bleedMm: Math.max(0, Number(e.target.value) || 0) }, false)}
                onBlur={persistNow}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                최종 출력 사이즈 <b>{finalSize?.widthMm} × {finalSize?.heightMm} mm</b> (블리드 {faceSettings.bleedMm}mm)
              </Typography>

              <Divider sx={{ my: 1.5 }} />

              {/* 안전영역 / 재단선 */}
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <FormControlLabel
                  control={<Switch size="small" checked={faceSettings.safeAreaOn} onChange={(e) => patchFace({ safeAreaOn: e.target.checked })} />}
                  label={<Typography variant="body2">Safe Area</Typography>}
                />
                <TextField
                  size="small" type="number" value={faceSettings.safeAreaMm} disabled={!faceSettings.safeAreaOn}
                  onChange={(e) => patchFace({ safeAreaMm: Math.max(0, Number(e.target.value) || 0) }, false)}
                  onBlur={persistNow}
                  sx={{ width: 90 }}
                  slotProps={{ input: { endAdornment: <Typography variant="caption">mm</Typography> } }}
                />
              </Stack>
              <FormControlLabel
                control={<Switch size="small" checked={faceSettings.cropMark} onChange={(e) => patchFace({ cropMark: e.target.checked })} />}
                label={<Typography variant="body2">Crop Mark (재단선)</Typography>}
              />

              <Divider sx={{ my: 1.5 }} />

              {/* 출력용 변형 */}
              <SectionTitle>출력용 변형 (화면 매핑과 별도)</SectionTitle>
              <SliderRow label={`Scale ${faceSettings.transform.scale.toFixed(2)}×`}>
                <Slider size="small" min={0.2} max={3} step={0.01} value={faceSettings.transform.scale}
                  onChange={(_, v) => patchTransform({ scale: v as number }, false)} onChangeCommitted={persistNow} />
              </SliderRow>
              <SliderRow label={`X Offset ${Math.round(faceSettings.transform.offsetX * 100)}%`}>
                <Slider size="small" min={-0.5} max={0.5} step={0.01} value={faceSettings.transform.offsetX}
                  onChange={(_, v) => patchTransform({ offsetX: v as number }, false)} onChangeCommitted={persistNow} />
              </SliderRow>
              <SliderRow label={`Y Offset ${Math.round(faceSettings.transform.offsetY * 100)}%`}>
                <Slider size="small" min={-0.5} max={0.5} step={0.01} value={faceSettings.transform.offsetY}
                  onChange={(_, v) => patchTransform({ offsetY: v as number }, false)} onChangeCommitted={persistNow} />
              </SliderRow>
              <SliderRow label={`Rotation ${faceSettings.transform.rotationDeg}°`}>
                <Slider size="small" min={-180} max={180} step={1} value={faceSettings.transform.rotationDeg}
                  onChange={(_, v) => patchTransform({ rotationDeg: v as number }, false)} onChangeCommitted={persistNow} />
              </SliderRow>
              <Stack direction="row" spacing={1}>
                <FormControlLabel
                  control={<Switch size="small" checked={faceSettings.transform.flipH} onChange={(e) => patchTransform({ flipH: e.target.checked })} />}
                  label={<Typography variant="caption">Flip H</Typography>}
                />
                <FormControlLabel
                  control={<Switch size="small" checked={faceSettings.transform.flipV} onChange={(e) => patchTransform({ flipV: e.target.checked })} />}
                  label={<Typography variant="caption">Flip V</Typography>}
                />
              </Stack>

              <Divider sx={{ my: 1.5 }} />

              {/* Export */}
              <SectionTitle>출력 (PDF / manifest)</SectionTitle>
              <Stack spacing={1}>
                <Button variant="contained" size="small" startIcon={<PictureAsPdfRoundedIcon />} onClick={handleFacePdf} disabled={busy}>
                  이 면 PDF ({face})
                </Button>
                <Button variant="outlined" size="small" startIcon={<DownloadRoundedIcon />} onClick={handleAllPdf} disabled={busy}>
                  모든 면 PDF (순차)
                </Button>
                <Button variant="text" size="small" startIcon={<DataObjectRoundedIcon />} onClick={handleManifest} disabled={busy}>
                  manifest.json
                </Button>
              </Stack>
              {busy && (
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">생성 중…</Typography>
                </Stack>
              )}

              <Paper variant="outlined" sx={{ p: 1, mt: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" color="text.secondary">
                  디자인 이미지는 Design Mapping 의 에셋을 그대로 사용합니다. 출력용 변형/사이즈는
                  화면 시안과 별도로 저장되어 자동/클라우드 저장에 반영됩니다.
                </Typography>
              </Paper>
            </Box>
          </Box>
        </>
      )}

      <Snackbar open={toast !== null} autoHideDuration={2600} onClose={() => setToast(null)} message={toast ?? ''} anchorOrigin={{ vertical: 'top', horizontal: 'center' }} />
    </Box>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
      {children}
    </Typography>
  );
}

function SliderRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ mb: 0.5 }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      {children}
    </Box>
  );
}

import { useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { useEditor } from '../editor/EditorContext';
import { getBoothBounds } from '../canvas/boothGeometry';
import {
  fileToFloorplanImage,
  isSupportedFloorplan,
  isCad,
  enhanceImage,
  DEFAULT_ENHANCE,
  type FloorplanImage,
  type Enhance,
} from './renderFloorplan';

type ScaleMode = 'line' | 'width';
interface Pt { x: number; y: number }

/**
 * Floorplan Import Wizard (v0.9.6) — 실제 행사장 도면(PDF/PNG/JPG/SVG)을 가져와
 * 스케일 보정 후 Background Layer 로 배치. 기준선 2점 + 실제 길이로 정밀 스케일 캘리브레이션.
 */
export default function FloorplanImportWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, addBackground } = useEditor();
  const [step, setStep] = useState(0);
  const [fileName, setFileName] = useState('');
  const [img, setImg] = useState<FloorplanImage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enhance, setEnhance] = useState<Enhance>({ ...DEFAULT_ENHANCE });
  const [mode, setMode] = useState<ScaleMode>('line');
  const [points, setPoints] = useState<Pt[]>([]); // 미리보기(표시) 좌표
  const [realMm, setRealMm] = useState(6000);
  const [overallWidthMm, setOverallWidthMm] = useState(20000);
  const fileRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const reset = () => {
    setStep(0);
    setFileName('');
    setImg(null);
    setError(null);
    setEnhance({ ...DEFAULT_ENHANCE });
    setPoints([]);
    setMode('line');
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (isCad(file)) {
      setError('DXF/DWG 벡터 파싱은 준비 중입니다. PDF 또는 이미지로 변환해 가져와 주세요.');
      return;
    }
    if (!isSupportedFloorplan(file)) {
      setError('지원 형식: PDF · PNG · JPG · SVG');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await fileToFloorplanImage(file);
      setImg(result);
      setFileName(file.name.replace(/\.[^.]+$/, ''));
      setPoints([]);
      setStep(1);
    } catch {
      setError('파일을 불러오지 못했습니다. 다른 파일로 시도하세요.');
    } finally {
      setLoading(false);
    }
  };

  const applyEnhance = async () => {
    if (!img) return;
    setLoading(true);
    try {
      const url = await enhanceImage(img.url, enhance);
      setImg({ ...img, url });
    } finally {
      setLoading(false);
    }
  };

  // 미리보기 클릭 → 기준선 점 (표시 좌표 → 원본 px 변환은 계산 시)
  const onPreviewClick = (e: React.MouseEvent) => {
    if (mode !== 'line' || step !== 2) return;
    const el = imgRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setPoints((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
  };

  // 스케일 계산
  const computeScale = (): { mmPerPx: number; wMm: number; hMm: number } | null => {
    if (!img) return null;
    if (mode === 'width') {
      const mmPerPx = overallWidthMm / img.widthPx;
      return { mmPerPx, wMm: overallWidthMm, hMm: Math.round(img.heightPx * mmPerPx) };
    }
    if (points.length < 2) return null;
    const el = imgRef.current;
    if (!el) return null;
    const ratio = img.widthPx / el.clientWidth; // 표시→원본 px
    const dxPx = (points[1].x - points[0].x) * ratio;
    const dyPx = (points[1].y - points[0].y) * ratio;
    const distPx = Math.hypot(dxPx, dyPx);
    if (distPx < 1) return null;
    const mmPerPx = realMm / distPx;
    return { mmPerPx, wMm: Math.round(img.widthPx * mmPerPx), hMm: Math.round(img.heightPx * mmPerPx) };
  };
  const scale = computeScale();

  const doImport = () => {
    if (!img || !scale || !project) return;
    const b = getBoothBounds(project.boothConfig);
    const cx = b.minX + b.widthMm / 2;
    const cy = b.minY + b.depthMm / 2;
    addBackground(
      { name: fileName || '도면', srcDataUrl: img.url, widthMm: scale.wMm, heightMm: scale.hMm },
      { xMm: Math.round(cx - scale.wMm / 2), yMm: Math.round(cy - scale.hMm / 2), opacity: 0.65, locked: false },
    );
    handleClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>도면 가져오기 (Floorplan Import)</DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={step} sx={{ mb: 2 }}>
          {['파일 선택', '미리보기 · 보정', '스케일 지정'].map((l) => (
            <Step key={l}><StepLabel>{l}</StepLabel></Step>
          ))}
        </Stepper>

        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        {step === 0 && (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <Button variant="contained" size="large" startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <UploadFileRoundedIcon />} onClick={() => fileRef.current?.click()} disabled={loading}>
              도면 파일 선택
            </Button>
            <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/svg+xml,.pdf,.png,.jpg,.jpeg,.svg,.dxf,.dwg" style={{ display: 'none' }} onChange={onFile} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
              지원: PDF · PNG · JPG · SVG (DXF/DWG 는 향후 지원)
            </Typography>
          </Box>
        )}

        {step >= 1 && img && (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            {/* 미리보기 */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: '#f1f5f9', cursor: mode === 'line' && step === 2 ? 'crosshair' : 'default' }}
                onClick={onPreviewClick}
              >
                <Box component="img" ref={imgRef} src={img.url} alt="도면" sx={{ width: '100%', display: 'block', maxHeight: '46vh', objectFit: 'contain' }} />
                {mode === 'line' && step === 2 && (
                  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
                    {points.length === 2 && <line x1={points[0].x} y1={points[0].y} x2={points[1].x} y2={points[1].y} stroke="#2563eb" strokeWidth={2} />}
                    {points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={5} fill="#2563eb" />)}
                  </svg>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                {img.kind.toUpperCase()} · {img.widthPx}×{img.heightPx}px
                {mode === 'line' && step === 2 && ` · 기준선 두 점을 클릭하세요 (${points.length}/2)`}
              </Typography>
            </Box>

            {/* 우측 컨트롤 */}
            <Box sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0 }}>
              {step === 1 && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>이미지 보정</Typography>
                  <Typography variant="caption" color="text.secondary">밝기 {enhance.brightness}</Typography>
                  <Slider size="small" min={-100} max={100} value={enhance.brightness} onChange={(_, v) => setEnhance((e) => ({ ...e, brightness: v as number }))} />
                  <Typography variant="caption" color="text.secondary">대비 {enhance.contrast}</Typography>
                  <Slider size="small" min={-100} max={100} value={enhance.contrast} onChange={(_, v) => setEnhance((e) => ({ ...e, contrast: v as number }))} />
                  <Stack direction="row" spacing={1}>
                    <FormControlLabel control={<Switch size="small" checked={enhance.invert} onChange={(e) => setEnhance((s) => ({ ...s, invert: e.target.checked }))} />} label={<Typography variant="caption">반전</Typography>} sx={{ ml: 0 }} />
                    <FormControlLabel control={<Switch size="small" checked={enhance.threshold} onChange={(e) => setEnhance((s) => ({ ...s, threshold: e.target.checked }))} />} label={<Typography variant="caption">흑백</Typography>} sx={{ ml: 0 }} />
                  </Stack>
                  <Button size="small" variant="outlined" fullWidth onClick={applyEnhance} disabled={loading} sx={{ mt: 1 }}>보정 적용</Button>
                </>
              )}

              {step === 2 && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>스케일 캘리브레이션</Typography>
                  <ToggleButtonGroup exclusive size="small" fullWidth value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 1.5 }}>
                    <ToggleButton value="line">기준선 2점</ToggleButton>
                    <ToggleButton value="width">전체 가로</ToggleButton>
                  </ToggleButtonGroup>

                  {mode === 'line' ? (
                    <TextField size="small" fullWidth type="number" label="기준선 실제 길이(mm)" value={realMm} onChange={(e) => setRealMm(Math.max(1, Number(e.target.value) || 0))} />
                  ) : (
                    <TextField size="small" fullWidth type="number" label="도면 전체 가로(mm)" value={overallWidthMm} onChange={(e) => setOverallWidthMm(Math.max(1, Number(e.target.value) || 0))} />
                  )}

                  {scale ? (
                    <Alert severity="success" sx={{ mt: 1.5 }}>
                      <Typography variant="caption" sx={{ display: 'block' }}>스케일 {scale.mmPerPx.toFixed(2)} mm/px</Typography>
                      <Typography variant="caption" sx={{ display: 'block' }}>도면 실제 크기 <b>{(scale.wMm / 1000).toFixed(2)} × {(scale.hMm / 1000).toFixed(2)} m</b></Typography>
                      <Chip size="small" color="success" label="정확도 100% (입력 기준)" sx={{ mt: 0.5, height: 20 }} />
                    </Alert>
                  ) : (
                    <Alert severity="info" sx={{ mt: 1.5 }}>
                      {mode === 'line' ? '미리보기에서 아는 길이의 두 점을 클릭하세요.' : '도면 전체 가로 실제 길이를 입력하세요.'}
                    </Alert>
                  )}
                </>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={handleClose}>취소</Button>
        {step === 1 && <Button variant="contained" onClick={() => setStep(2)} disabled={!img}>다음</Button>}
        {step === 2 && (
          <>
            <Button color="inherit" onClick={() => setStep(1)}>이전</Button>
            <Button variant="contained" onClick={doImport} disabled={!scale || !project}>도면 가져오기</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

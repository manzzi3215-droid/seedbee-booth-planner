import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormHelperText from '@mui/material/FormHelperText';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useNavigate } from 'react-router-dom';
import type { OpenSide, FloorType, Project, BoothShape, PointMm, PlacedImage, Layout } from '../types';
import {
  OPEN_SIDE_OPTIONS,
  FLOOR_TYPE_OPTIONS,
  BOOTH_SHAPE_OPTIONS,
  DEFAULT_POLYGON_POINTS,
} from '../constants/booth';
import { storage } from '../storage';
import { generateId } from '../utils/id';
import { getBoothBounds } from '../features/canvas/boothGeometry';
import {
  fileToFloorplanImage,
  isSupportedFloorplan,
  isCad,
  type FloorplanImage,
} from '../features/floorplan/renderFloorplan';
import PolygonPointsEditor, {
  type PointInput,
} from '../features/booth/PolygonPointsEditor';

/**
 * 새 프로젝트 생성 화면 (/projects/new).
 *
 * 입력값을 검증한 뒤 Project 로 만들어 storage.saveProject 로 저장하고,
 * 저장된 프로젝트의 편집기(/projects/:id/editor)로 이동합니다.
 * ⚠️ localStorage 를 직접 호출하지 않고 반드시 storage provider 만 사용합니다.
 */

interface FormErrors {
  name?: string;
  widthMm?: string;
  depthMm?: string;
  heightMm?: string;
  customFloorName?: string;
  polygonPoints?: string;
}

const toPointInputs = (points: PointMm[]): PointInput[] =>
  points.map((p) => ({ x: String(p.xMm), y: String(p.yMm) }));

export default function NewProjectPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [boothShape, setBoothShape] = useState<BoothShape>('rectangle');
  const [widthMm, setWidthMm] = useState('');
  const [depthMm, setDepthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [heightUnset, setHeightUnset] = useState(false);
  const [openSide, setOpenSide] = useState<OpenSide>(1);
  const [floorType, setFloorType] = useState<FloorType>('pytex');
  const [customFloorName, setCustomFloorName] = useState('');
  const [polygonPoints, setPolygonPoints] = useState<PointInput[]>(
    toPointInputs(DEFAULT_POLYGON_POINTS),
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // 프로젝트 관리 정보 (선택, v1.1.0)
  const [brand, setBrand] = useState('');
  const [eventPeriod, setEventPeriod] = useState('');
  const [place, setPlace] = useState('');
  const [manager, setManager] = useState('');
  const [projectMemo, setProjectMemo] = useState('');

  // 도면(선택) — 새 프로젝트 생성 시 배경 도면 첨부 (v1.0.9)
  const [drawing, setDrawing] = useState<FloorplanImage | null>(null);
  const [drawingName, setDrawingName] = useState('');
  const [drawingWidthMm, setDrawingWidthMm] = useState(''); // 도면 실제 가로(mm). 비우면 부스 가로 사용
  const [drawingLoading, setDrawingLoading] = useState(false);
  const [drawingError, setDrawingError] = useState<string | null>(null);
  const drawingFileRef = useRef<HTMLInputElement>(null);

  const onDrawingFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (isCad(file)) {
      setDrawingError('DXF/DWG 는 지원하지 않습니다. PDF 또는 이미지로 변환해 가져오세요.');
      return;
    }
    if (!isSupportedFloorplan(file)) {
      setDrawingError('지원 형식: PDF · PNG · JPG · SVG');
      return;
    }
    setDrawingError(null);
    setDrawingLoading(true);
    try {
      const img = await fileToFloorplanImage(file);
      setDrawing(img);
      setDrawingName(file.name.replace(/\.[^.]+$/, ''));
    } catch {
      setDrawingError('파일을 불러오지 못했습니다. 다른 파일로 시도하세요.');
    } finally {
      setDrawingLoading(false);
    }
  };

  const changeBoothShape = (shape: BoothShape) => {
    setBoothShape(shape);
    // 다각형으로 전환 시 기본 예시 폴리곤 세팅(비어있을 때만)
    if (shape === 'polygon' && polygonPoints.length < 3) {
      setPolygonPoints(toPointInputs(DEFAULT_POLYGON_POINTS));
    }
  };

  /** 치수 문자열을 검증하고 숫자로 반환 (1 이상). 실패 시 메시지 반환 */
  const validateDimension = (raw: string): { value: number; error?: string } => {
    const value = Number(raw);
    if (raw.trim() === '' || Number.isNaN(value)) {
      return { value: NaN, error: '숫자를 입력하세요.' };
    }
    if (value < 1) {
      return { value, error: '1 이상 입력하세요.' };
    }
    return { value };
  };

  const validate = (): { ok: boolean; errors: FormErrors; boothConfig?: Project['boothConfig'] } => {
    const next: FormErrors = {};

    if (name.trim().length === 0) {
      next.name = '행사명을 입력하세요.';
    }

    // 높이는 선택값: "설정 안 함" 이면 검증 생략(null)
    const h = heightUnset ? { value: NaN as number, error: undefined } : validateDimension(heightMm);
    if (h.error) next.heightMm = h.error;

    if (floorType === 'custom' && customFloorName.trim().length === 0) {
      next.customFloorName = '바닥 종류를 직접 입력하세요.';
    }

    // 형태별 치수/폴리곤 검증
    let width = 0;
    let depth = 0;
    let parsedPolygon: PointMm[] | undefined;

    if (boothShape === 'rectangle') {
      const w = validateDimension(widthMm);
      const d = validateDimension(depthMm);
      if (w.error) next.widthMm = w.error;
      if (d.error) next.depthMm = d.error;
      width = w.value;
      depth = d.value;
    } else {
      // polygon: 각 점 숫자(0 이상), 최소 3개, 바운딩 박스 유효
      const pts: PointMm[] = [];
      let invalid = false;
      for (const p of polygonPoints) {
        const x = Number(p.x);
        const y = Number(p.y);
        if (p.x.trim() === '' || p.y.trim() === '' || Number.isNaN(x) || Number.isNaN(y) || x < 0 || y < 0) {
          invalid = true;
          break;
        }
        pts.push({ xMm: x, yMm: y });
      }
      if (invalid || pts.length < 3) {
        next.polygonPoints = '유효한 꼭짓점을 3개 이상 입력하세요 (좌표는 0 이상).';
      } else {
        const xs = pts.map((p) => p.xMm);
        const ys = pts.map((p) => p.yMm);
        width = Math.max(...xs) - Math.min(...xs);
        depth = Math.max(...ys) - Math.min(...ys);
        if (width < 1 || depth < 1) {
          next.polygonPoints = '꼭짓점이 면적을 이루지 않습니다.';
        } else {
          parsedPolygon = pts;
        }
      }
    }

    const ok = Object.keys(next).length === 0;
    if (!ok) return { ok, errors: next };

    return {
      ok,
      errors: next,
      boothConfig: {
        widthMm: width,
        depthMm: depth,
        heightMm: heightUnset ? null : h.value,
        openSide,
        floorType,
        customFloorName: floorType === 'custom' ? customFloorName.trim() : undefined,
        boothShape,
        polygonPoints: boothShape === 'polygon' ? parsedPolygon : undefined,
      },
    };
  };

  const handleNext = async () => {
    const result = validate();
    setErrors(result.errors);
    if (!result.ok || !result.boothConfig) return;

    setSaving(true);
    try {
      const now = Date.now();
      // 도면이 첨부되면 초기 배치안(v1)에 배경 도면으로 넣어 편집기에서 바로 사용 (v1.0.9)
      const layouts: Layout[] = [];
      if (drawing) {
        const b = getBoothBounds(result.boothConfig);
        const wMm = Math.max(1, Math.round(Number(drawingWidthMm) || b.widthMm || drawing.widthPx));
        const hMm = Math.max(1, Math.round(wMm * (drawing.heightPx / (drawing.widthPx || 1))));
        const cx = b.minX + b.widthMm / 2;
        const cy = b.minY + b.depthMm / 2;
        const bg: PlacedImage = {
          id: generateId(),
          name: drawingName || '도면',
          srcDataUrl: drawing.url,
          xMm: Math.round(cx - wMm / 2),
          yMm: Math.round(cy - hMm / 2),
          widthMm: wMm,
          heightMm: hMm,
          rotationDeg: 0,
          opacity: 0.65,
          locked: false,
        };
        layouts.push({
          id: generateId(),
          name: 'v1',
          placedFixtures: [],
          planBackgrounds: [bg],
          createdAt: now,
          updatedAt: now,
        });
      }
      const project: Project = {
        id: generateId(),
        name: name.trim(),
        boothConfig: result.boothConfig,
        layouts,
        // 관리 정보(선택) — 입력값이 있을 때만 저장 (하위 호환)
        brand: brand.trim() || undefined,
        eventPeriod: eventPeriod.trim() || undefined,
        place: place.trim() || undefined,
        manager: manager.trim() || undefined,
        projectMemo: projectMemo.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      await storage.saveProject(project);
      navigate(`/projects/${project.id}/editor`);
    } finally {
      setSaving(false);
    }
  };

  const mmAdornment = <InputAdornment position="end">mm</InputAdornment>;

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 3 }}>
        새 프로젝트 만들기
      </Typography>

      <Paper
        elevation={0}
        sx={{ p: { xs: 2.5, sm: 4 }, border: '1px solid', borderColor: 'divider' }}
      >
        <Stack spacing={3}>
          <TextField
            label="행사명"
            placeholder="예) 메가쇼 2026"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            error={Boolean(errors.name)}
            helperText={errors.name}
          />

          <Divider textAlign="left">
            <Typography variant="caption" color="text.secondary">
              관리 정보 (선택)
            </Typography>
          </Divider>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="브랜드" value={brand} onChange={(e) => setBrand(e.target.value)} fullWidth />
            <TextField label="담당자" value={manager} onChange={(e) => setManager(e.target.value)} fullWidth />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="행사 기간" value={eventPeriod} onChange={(e) => setEventPeriod(e.target.value)} placeholder="예) 2026-03-01 ~ 03-05" fullWidth />
            <TextField label="장소" value={place} onChange={(e) => setPlace(e.target.value)} fullWidth />
          </Stack>
          <TextField label="메모" value={projectMemo} onChange={(e) => setProjectMemo(e.target.value)} fullWidth multiline minRows={2} />

          <Divider textAlign="left">
            <Typography variant="caption" color="text.secondary">
              부스 형태 · 치수
            </Typography>
          </Divider>

          <Box>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              부스 형태
            </Typography>
            <ToggleButtonGroup
              exclusive
              color="primary"
              value={boothShape}
              onChange={(_, v) => v !== null && changeBoothShape(v as BoothShape)}
            >
              {BOOTH_SHAPE_OPTIONS.map((opt) => (
                <ToggleButton key={opt.value} value={opt.value} sx={{ px: 3 }}>
                  {opt.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {boothShape === 'rectangle' && (
              <>
                <TextField
                  label="부스 가로"
                  type="number"
                  value={widthMm}
                  onChange={(e) => setWidthMm(e.target.value)}
                  fullWidth
                  error={Boolean(errors.widthMm)}
                  helperText={errors.widthMm}
                  slotProps={{ input: { endAdornment: mmAdornment } }}
                />
                <TextField
                  label="부스 세로"
                  type="number"
                  value={depthMm}
                  onChange={(e) => setDepthMm(e.target.value)}
                  fullWidth
                  error={Boolean(errors.depthMm)}
                  helperText={errors.depthMm}
                  slotProps={{ input: { endAdornment: mmAdornment } }}
                />
              </>
            )}
            <TextField
              label="부스 높이"
              type="number"
              value={heightUnset ? '' : heightMm}
              onChange={(e) => setHeightMm(e.target.value)}
              fullWidth
              disabled={heightUnset}
              error={Boolean(errors.heightMm)}
              helperText={errors.heightMm}
              slotProps={{ input: { endAdornment: mmAdornment } }}
            />
          </Stack>

          <FormControlLabel
            control={
              <Checkbox
                checked={heightUnset}
                onChange={(e) => setHeightUnset(e.target.checked)}
              />
            }
            label="높이 설정 안 함 (벽면 전개도·3D 미리보기는 나중에 높이를 설정해야 사용 가능)"
          />
          {heightUnset && (
            <Alert severity="info">
              높이를 설정하지 않으면 벽면 전개도와 3D 미리보기 기능을 사용할 수 없습니다.
            </Alert>
          )}

          {boothShape === 'polygon' && (
            <PolygonPointsEditor
              points={polygonPoints}
              onChange={setPolygonPoints}
              error={errors.polygonPoints}
            />
          )}

          {boothShape === 'rectangle' && (
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                오픈면
              </Typography>
              <ToggleButtonGroup
                exclusive
                color="primary"
                value={openSide}
                onChange={(_, v) => v !== null && setOpenSide(v as OpenSide)}
              >
                {OPEN_SIDE_OPTIONS.map((opt) => (
                  <ToggleButton key={opt.value} value={opt.value} sx={{ px: 3 }}>
                    {opt.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
          )}

          <Box>
            <TextField
              select
              label="바닥 종류"
              value={floorType}
              onChange={(e) => setFloorType(e.target.value as FloorType)}
              fullWidth
            >
              {FLOOR_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            {floorType === 'custom' && (
              <TextField
                label="바닥 종류 직접입력"
                placeholder="예) 카펫, 우드플로어 등"
                value={customFloorName}
                onChange={(e) => setCustomFloorName(e.target.value)}
                fullWidth
                error={Boolean(errors.customFloorName)}
                helperText={errors.customFloorName}
                sx={{ mt: 2 }}
              />
            )}
            {floorType !== 'custom' && errors.customFloorName && (
              <FormHelperText error>{errors.customFloorName}</FormHelperText>
            )}
          </Box>

          <Divider textAlign="left">
            <Typography variant="caption" color="text.secondary">
              도면 (선택) — 실제 행사장 도면을 배경으로
            </Typography>
          </Divider>

          {drawingError && <Alert severity="warning">{drawingError}</Alert>}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Box sx={{ flex: 1 }}>
              <Button
                variant="outlined"
                startIcon={drawingLoading ? <CircularProgress size={16} /> : <UploadFileRoundedIcon />}
                onClick={() => drawingFileRef.current?.click()}
                disabled={drawingLoading}
              >
                도면 파일 추가 (PDF · PNG · JPG · SVG)
              </Button>
              <input
                ref={drawingFileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/svg+xml,.pdf,.png,.jpg,.jpeg,.svg"
                style={{ display: 'none' }}
                onChange={onDrawingFile}
              />
              {drawing && (
                <TextField
                  label="도면 실제 가로"
                  type="number"
                  size="small"
                  value={drawingWidthMm}
                  onChange={(e) => setDrawingWidthMm(e.target.value)}
                  placeholder={String(Math.round(Number(widthMm) || 0) || '부스 가로')}
                  helperText="비우면 부스 가로에 맞춰 배치됩니다."
                  slotProps={{ input: { endAdornment: mmAdornment } }}
                  sx={{ mt: 1.5, display: 'block', maxWidth: 220 }}
                />
              )}
            </Box>

            {drawing && (
              <Box sx={{ width: { xs: '100%', sm: 240 }, flexShrink: 0 }}>
                <Box sx={{ position: 'relative', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: '#f1f5f9' }}>
                  <Box component="img" src={drawing.url} alt="도면 미리보기" sx={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'contain' }} />
                  <IconButton size="small" onClick={() => { setDrawing(null); setDrawingName(''); setDrawingWidthMm(''); }} sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(255,255,255,0.85)' }}>
                    <DeleteOutlineRoundedIcon fontSize="small" color="error" />
                  </IconButton>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {drawing.kind.toUpperCase()} · {drawing.widthPx}×{drawing.heightPx}px
                </Typography>
              </Box>
            )}
          </Stack>
        </Stack>

        <Divider sx={{ my: 3 }} />

        <Stack direction="row" spacing={2} sx={{ justifyContent: 'flex-end' }}>
          <Button
            variant="text"
            color="inherit"
            disabled={saving}
            onClick={() => navigate('/projects')}
          >
            취소
          </Button>
          <Button variant="contained" disabled={saving} onClick={handleNext}>
            다음
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

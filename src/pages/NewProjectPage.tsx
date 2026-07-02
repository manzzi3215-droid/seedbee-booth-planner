import { useState } from 'react';
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
import InputAdornment from '@mui/material/InputAdornment';
import { useNavigate } from 'react-router-dom';
import type { OpenSide, FloorType, Project, BoothShape, PointMm } from '../types';
import {
  OPEN_SIDE_OPTIONS,
  FLOOR_TYPE_OPTIONS,
  BOOTH_SHAPE_OPTIONS,
  DEFAULT_POLYGON_POINTS,
} from '../constants/booth';
import { storage } from '../storage';
import { generateId } from '../utils/id';
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
  const [openSide, setOpenSide] = useState<OpenSide>(1);
  const [floorType, setFloorType] = useState<FloorType>('pytex');
  const [customFloorName, setCustomFloorName] = useState('');
  const [polygonPoints, setPolygonPoints] = useState<PointInput[]>(
    toPointInputs(DEFAULT_POLYGON_POINTS),
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

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

    const h = validateDimension(heightMm);
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
        heightMm: h.value,
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
      const project: Project = {
        id: generateId(),
        name: name.trim(),
        boothConfig: result.boothConfig,
        layouts: [],
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
              value={heightMm}
              onChange={(e) => setHeightMm(e.target.value)}
              fullWidth
              error={Boolean(errors.heightMm)}
              helperText={errors.heightMm}
              slotProps={{ input: { endAdornment: mmAdornment } }}
            />
          </Stack>

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

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
import type { OpenSide, FloorType, Project } from '../types';
import { OPEN_SIDE_OPTIONS, FLOOR_TYPE_OPTIONS } from '../constants/booth';
import { storage } from '../storage';
import { generateId } from '../utils/id';

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
}

export default function NewProjectPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [depthMm, setDepthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [openSide, setOpenSide] = useState<OpenSide>(1);
  const [floorType, setFloorType] = useState<FloorType>('pytex');
  const [customFloorName, setCustomFloorName] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

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

    const w = validateDimension(widthMm);
    const d = validateDimension(depthMm);
    const h = validateDimension(heightMm);
    if (w.error) next.widthMm = w.error;
    if (d.error) next.depthMm = d.error;
    if (h.error) next.heightMm = h.error;

    if (floorType === 'custom' && customFloorName.trim().length === 0) {
      next.customFloorName = '바닥 종류를 직접 입력하세요.';
    }

    const ok = Object.keys(next).length === 0;
    if (!ok) return { ok, errors: next };

    return {
      ok,
      errors: next,
      boothConfig: {
        widthMm: w.value,
        depthMm: d.value,
        heightMm: h.value,
        openSide,
        floorType,
        customFloorName: floorType === 'custom' ? customFloorName.trim() : undefined,
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
              부스 치수
            </Typography>
          </Divider>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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

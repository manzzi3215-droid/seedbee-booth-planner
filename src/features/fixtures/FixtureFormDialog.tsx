import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import type { FixtureDef, FixtureShape } from '../../types';
import { generateId } from '../../utils/id';
import { SHAPE_OPTIONS, NOT_YET_RENDERED_SHAPES } from './shapes';

interface FixtureFormDialogProps {
  open: boolean;
  /** 수정 대상. null 이면 신규 추가 */
  fixture: FixtureDef | null;
  onClose: () => void;
  onSubmit: (fixture: FixtureDef) => void | Promise<void>;
}

interface FormErrors {
  name?: string;
  widthMm?: string;
  depthMm?: string;
  heightMm?: string;
  cornerRadiusMm?: string;
}

const DEFAULT_COLOR = '#8d6e63';

/** 숫자 문자열 검증 (min 이상) */
function validateNumber(raw: string, min: number): { value: number; error?: string } {
  const value = Number(raw);
  if (raw.trim() === '' || Number.isNaN(value)) {
    return { value: NaN, error: '숫자를 입력하세요.' };
  }
  if (value < min) {
    return { value, error: `${min} 이상 입력하세요.` };
  }
  return { value };
}

/**
 * 집기 추가/수정 Dialog.
 * 검증 규칙:
 *  - 집기명 필수
 *  - 가로/세로/높이 1 이상
 *  - roundedRectangle 이면 cornerRadiusMm 0 이상, 그리고 가로·세로 절반 이하
 */
export default function FixtureFormDialog({
  open,
  fixture,
  onClose,
  onSubmit,
}: FixtureFormDialogProps) {
  const [name, setName] = useState('');
  const [widthMm, setWidthMm] = useState('');
  const [depthMm, setDepthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');
  const [shape, setShape] = useState<FixtureShape>('rectangle');
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [memo, setMemo] = useState('');
  const [cornerRadiusMm, setCornerRadiusMm] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);

  // 다이얼로그가 열릴 때 폼 초기화 (수정이면 기존 값 채움)
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setName(fixture?.name ?? '');
    setWidthMm(fixture ? String(fixture.widthMm) : '');
    setDepthMm(fixture ? String(fixture.depthMm) : '');
    setHeightMm(fixture?.heightMm != null ? String(fixture.heightMm) : '');
    setShape(fixture?.shape ?? 'rectangle');
    setColor(fixture?.color ?? DEFAULT_COLOR);
    setMemo(fixture?.memo ?? '');
    setCornerRadiusMm(
      fixture?.cornerRadiusMm != null ? String(fixture.cornerRadiusMm) : '',
    );
  }, [open, fixture]);

  const validate = (): { ok: boolean; errors: FormErrors; result?: FixtureDef } => {
    const next: FormErrors = {};

    if (name.trim().length === 0) next.name = '집기명을 입력하세요.';

    const w = validateNumber(widthMm, 1);
    const d = validateNumber(depthMm, 1);
    const h = validateNumber(heightMm, 1);
    if (w.error) next.widthMm = w.error;
    if (d.error) next.depthMm = d.error;
    if (h.error) next.heightMm = h.error;

    let corner: number | undefined;
    if (shape === 'roundedRectangle') {
      const c = validateNumber(cornerRadiusMm, 0);
      if (c.error) {
        next.cornerRadiusMm = c.error;
      } else if (!w.error && !d.error) {
        const maxCorner = Math.min(w.value, d.value) / 2;
        if (c.value > maxCorner) {
          next.cornerRadiusMm = `가로·세로 절반(${maxCorner}mm) 이하여야 합니다.`;
        } else {
          corner = c.value;
        }
      }
    }

    const ok = Object.keys(next).length === 0;
    if (!ok) return { ok, errors: next };

    return {
      ok,
      errors: next,
      result: {
        id: fixture?.id ?? generateId(),
        name: name.trim(),
        shape,
        widthMm: w.value,
        depthMm: d.value,
        heightMm: h.value,
        color,
        memo: memo.trim() || undefined,
        cornerRadiusMm: shape === 'roundedRectangle' ? corner : undefined,
        // 기존 pathPoints 는 편집 시 보존 (customPath 편집기는 추후)
        pathPoints: fixture?.pathPoints,
      },
    };
  };

  const handleSubmit = async () => {
    const res = validate();
    setErrors(res.errors);
    if (!res.ok || !res.result) return;
    setSaving(true);
    try {
      await onSubmit(res.result);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const mm = <InputAdornment position="end">mm</InputAdornment>;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{fixture ? '집기 수정' : '집기 추가'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 0.5 }}>
          <TextField
            label="집기명"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            required
            autoFocus
            error={Boolean(errors.name)}
            helperText={errors.name}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="가로"
              type="number"
              value={widthMm}
              onChange={(e) => setWidthMm(e.target.value)}
              fullWidth
              error={Boolean(errors.widthMm)}
              helperText={errors.widthMm}
              slotProps={{ input: { endAdornment: mm } }}
            />
            <TextField
              label="세로"
              type="number"
              value={depthMm}
              onChange={(e) => setDepthMm(e.target.value)}
              fullWidth
              error={Boolean(errors.depthMm)}
              helperText={errors.depthMm}
              slotProps={{ input: { endAdornment: mm } }}
            />
            <TextField
              label="높이"
              type="number"
              value={heightMm}
              onChange={(e) => setHeightMm(e.target.value)}
              fullWidth
              error={Boolean(errors.heightMm)}
              helperText={errors.heightMm}
              slotProps={{ input: { endAdornment: mm } }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="형태"
              value={shape}
              onChange={(e) => setShape(e.target.value as FixtureShape)}
              fullWidth
            >
              {SHAPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 160 }}>
              <TextField
                type="color"
                label="색상"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                sx={{ width: 90 }}
              />
              <Typography variant="body2" color="text.secondary">
                {color.toUpperCase()}
              </Typography>
            </Box>
          </Stack>

          {shape === 'roundedRectangle' && (
            <TextField
              label="코너 반경 (cornerRadius)"
              type="number"
              value={cornerRadiusMm}
              onChange={(e) => setCornerRadiusMm(e.target.value)}
              fullWidth
              error={Boolean(errors.cornerRadiusMm)}
              helperText={errors.cornerRadiusMm ?? '가로·세로 절반 이하'}
              slotProps={{ input: { endAdornment: mm } }}
            />
          )}

          {NOT_YET_RENDERED_SHAPES.includes(shape) && (
            <Alert severity="info">
              커스텀 경로(customPath) 형태의 캔버스 렌더링은 추후 지원 예정입니다.
              지금은 등록/수정만 가능합니다.
            </Alert>
          )}

          <TextField
            label="메모"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={saving}>
          {fixture ? '저장' : '추가'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

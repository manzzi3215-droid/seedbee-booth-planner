import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Rotate90DegreesCwRoundedIcon from '@mui/icons-material/Rotate90DegreesCwRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useEditor } from './EditorContext';
import { dimensionLengthMm } from '../dimensions/constants';

/** 치수선 선택 정보 패널 */
export default function DimensionPanel() {
  const {
    selectedDimension: selected,
    updateSelectedDimension,
    rotateSelected,
    copySelected,
    deleteSelected,
  } = useEditor();

  const [sx, setSx] = useState('');
  const [sy, setSy] = useState('');
  const [ex, setEx] = useState('');
  const [ey, setEy] = useState('');
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (!selected) return;
    setSx(String(Math.round(selected.startXMm)));
    setSy(String(Math.round(selected.startYMm)));
    setEx(String(Math.round(selected.endXMm)));
    setEy(String(Math.round(selected.endYMm)));
    setLabel(selected.label ?? '');
  }, [
    selected?.id,
    selected?.startXMm,
    selected?.startYMm,
    selected?.endXMm,
    selected?.endYMm,
    selected?.label,
    selected,
  ]);

  if (!selected) return null;

  const applyNum = (raw: string, key: 'startXMm' | 'startYMm' | 'endXMm' | 'endYMm') => {
    const v = Number(raw);
    if (raw.trim() === '' || Number.isNaN(v)) return;
    updateSelectedDimension({ [key]: v });
  };

  const lengthMm = Math.round(dimensionLengthMm(selected));

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
        치수선 정보
      </Typography>

      <Typography variant="caption" color="text.secondary">시작점</Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField label="시작 X" type="number" size="small" value={sx}
          onChange={(e) => { setSx(e.target.value); applyNum(e.target.value, 'startXMm'); }}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }} />
        <TextField label="시작 Y" type="number" size="small" value={sy}
          onChange={(e) => { setSy(e.target.value); applyNum(e.target.value, 'startYMm'); }}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }} />
      </Stack>

      <Typography variant="caption" color="text.secondary">끝점</Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField label="끝 X" type="number" size="small" value={ex}
          onChange={(e) => { setEx(e.target.value); applyNum(e.target.value, 'endXMm'); }}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }} />
        <TextField label="끝 Y" type="number" size="small" value={ey}
          onChange={(e) => { setEy(e.target.value); applyNum(e.target.value, 'endYMm'); }}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }} />
      </Stack>

      <Stack direction="row" sx={{ justifyContent: 'space-between', py: 0.5 }}>
        <Typography variant="body2" color="text.secondary">자동 길이</Typography>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{lengthMm} mm</Typography>
      </Stack>

      <Divider sx={{ my: 1 }} />

      <TextField
        label="표시 텍스트 (비우면 자동 길이)"
        value={label}
        onChange={(e) => { setLabel(e.target.value); updateSelectedDimension({ label: e.target.value }); }}
        fullWidth size="small" sx={{ mb: 1.5 }}
        placeholder={`${lengthMm} mm`}
      />

      <Stack direction="row" spacing={2} sx={{ mb: 1, alignItems: 'center' }}>
        <TextField type="color" label="선 색상" size="small" sx={{ width: 80 }}
          value={selected.color}
          onChange={(e) => updateSelectedDimension({ color: e.target.value })} />
        <TextField type="color" label="글자 색상" size="small" sx={{ width: 80 }}
          value={selected.textColor}
          onChange={(e) => updateSelectedDimension({ textColor: e.target.value })} />
      </Stack>

      <FormControlLabel
        control={
          <Checkbox size="small" checked={selected.showArrows}
            onChange={(e) => updateSelectedDimension({ showArrows: e.target.checked })} />
        }
        label={<Typography variant="body2">화살표 표시</Typography>}
        sx={{ mb: 1 }}
      />

      <Divider sx={{ my: 1 }} />

      <Stack spacing={1}>
        <Button variant="outlined" startIcon={<Rotate90DegreesCwRoundedIcon />} onClick={rotateSelected} fullWidth>
          90도 회전
        </Button>
        <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={copySelected} fullWidth>
          복사
        </Button>
        <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={deleteSelected} fullWidth>
          삭제
        </Button>
      </Stack>
    </Box>
  );
}

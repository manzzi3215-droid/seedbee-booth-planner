import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import InputAdornment from '@mui/material/InputAdornment';
import Rotate90DegreesCwRoundedIcon from '@mui/icons-material/Rotate90DegreesCwRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useEditor } from './EditorContext';

/** 이미지 선택 정보 패널 */
export default function ImagePanel() {
  const {
    selectedImage: selected,
    updateSelectedImage,
    rotateSelected,
    copySelected,
    deleteSelected,
  } = useEditor();

  const [name, setName] = useState('');
  const [xStr, setXStr] = useState('');
  const [yStr, setYStr] = useState('');
  const [wStr, setWStr] = useState('');
  const [hStr, setHStr] = useState('');
  const [rotStr, setRotStr] = useState('');

  useEffect(() => {
    if (!selected) return;
    setName(selected.name);
    setXStr(String(Math.round(selected.xMm)));
    setYStr(String(Math.round(selected.yMm)));
    setWStr(String(Math.round(selected.widthMm)));
    setHStr(String(Math.round(selected.heightMm)));
    setRotStr(String(Math.round(selected.rotationDeg)));
  }, [selected?.id, selected?.xMm, selected?.yMm, selected?.widthMm, selected?.heightMm, selected?.rotationDeg, selected]);

  if (!selected) return null;

  const applyNum = (raw: string, key: 'xMm' | 'yMm' | 'widthMm' | 'heightMm' | 'rotationDeg') => {
    const v = Number(raw);
    if (raw.trim() === '' || Number.isNaN(v)) return;
    if ((key === 'widthMm' || key === 'heightMm') && v < 1) return;
    updateSelectedImage({ [key]: v });
  };

  const mm = <InputAdornment position="end">mm</InputAdornment>;

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
        이미지 정보
      </Typography>

      <Box sx={{ mb: 1.5, textAlign: 'center' }}>
        <img
          src={selected.srcDataUrl}
          alt={selected.name}
          style={{ maxWidth: '100%', maxHeight: 100, border: '1px solid #e2e8f0', borderRadius: 4 }}
        />
      </Box>

      <TextField
        label="이미지명"
        value={name}
        onChange={(e) => { setName(e.target.value); updateSelectedImage({ name: e.target.value }); }}
        fullWidth size="small" sx={{ mb: 1.5 }}
      />

      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField label="X" type="number" size="small" value={xStr}
          onChange={(e) => { setXStr(e.target.value); applyNum(e.target.value, 'xMm'); }}
          slotProps={{ input: { endAdornment: mm } }} />
        <TextField label="Y" type="number" size="small" value={yStr}
          onChange={(e) => { setYStr(e.target.value); applyNum(e.target.value, 'yMm'); }}
          slotProps={{ input: { endAdornment: mm } }} />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField label="가로" type="number" size="small" value={wStr}
          onChange={(e) => { setWStr(e.target.value); applyNum(e.target.value, 'widthMm'); }}
          slotProps={{ input: { endAdornment: mm } }} />
        <TextField label="세로" type="number" size="small" value={hStr}
          onChange={(e) => { setHStr(e.target.value); applyNum(e.target.value, 'heightMm'); }}
          slotProps={{ input: { endAdornment: mm } }} />
      </Stack>
      <TextField label="회전" type="number" size="small" value={rotStr} sx={{ mb: 1.5 }}
        onChange={(e) => { setRotStr(e.target.value); applyNum(e.target.value, 'rotationDeg'); }}
        slotProps={{ input: { endAdornment: <InputAdornment position="end">°</InputAdornment> } }} />

      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        투명도 {Math.round(selected.opacity * 100)}%
      </Typography>
      <Slider
        size="small"
        min={0}
        max={1}
        step={0.05}
        value={selected.opacity}
        onChange={(_, v) => updateSelectedImage({ opacity: v as number })}
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

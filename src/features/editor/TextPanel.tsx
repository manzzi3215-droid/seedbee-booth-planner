import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import InputAdornment from '@mui/material/InputAdornment';
import Rotate90DegreesCwRoundedIcon from '@mui/icons-material/Rotate90DegreesCwRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import type { TextAlign } from '../../types';
import { useEditor } from './EditorContext';

const DEFAULT_BG = '#fde68a';

/** 텍스트 선택 정보 패널 — 내용/위치/스타일 수정 + 복사/삭제 */
export default function TextPanel() {
  const {
    selectedText: selected,
    updateSelectedText,
    rotateSelected,
    copySelected,
    deleteSelected,
  } = useEditor();

  const [content, setContent] = useState('');
  const [xStr, setXStr] = useState('');
  const [yStr, setYStr] = useState('');
  const [rotStr, setRotStr] = useState('');
  const [sizeStr, setSizeStr] = useState('');

  useEffect(() => {
    if (!selected) return;
    setContent(selected.text);
    setXStr(String(Math.round(selected.xMm)));
    setYStr(String(Math.round(selected.yMm)));
    setRotStr(String(selected.rotationDeg));
    setSizeStr(String(selected.fontSizeMm));
  }, [selected?.id, selected?.xMm, selected?.yMm, selected?.rotationDeg, selected?.fontSizeMm, selected]);

  if (!selected) return null;

  const applyNum = (raw: string, key: 'xMm' | 'yMm' | 'rotationDeg' | 'fontSizeMm') => {
    const v = Number(raw);
    if (raw.trim() === '' || Number.isNaN(v)) return;
    if (key === 'fontSizeMm' && v <= 0) return;
    updateSelectedText({ [key]: v });
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
        텍스트 정보
      </Typography>

      <TextField
        label="텍스트 내용"
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          updateSelectedText({ text: e.target.value });
        }}
        fullWidth
        multiline
        minRows={2}
        size="small"
        sx={{ mb: 1.5 }}
      />

      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          label="X" type="number" size="small" value={xStr}
          onChange={(e) => { setXStr(e.target.value); applyNum(e.target.value, 'xMm'); }}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }}
        />
        <TextField
          label="Y" type="number" size="small" value={yStr}
          onChange={(e) => { setYStr(e.target.value); applyNum(e.target.value, 'yMm'); }}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }}
        />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <TextField
          label="회전" type="number" size="small" value={rotStr}
          onChange={(e) => { setRotStr(e.target.value); applyNum(e.target.value, 'rotationDeg'); }}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">°</InputAdornment> } }}
        />
        <TextField
          label="글자 크기" type="number" size="small" value={sizeStr}
          onChange={(e) => { setSizeStr(e.target.value); applyNum(e.target.value, 'fontSizeMm'); }}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }}
        />
      </Stack>

      <Divider sx={{ my: 1 }} />

      {/* 색상 */}
      <Stack direction="row" spacing={2} sx={{ mb: 1, alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="color" label="글자색" size="small" sx={{ width: 76 }}
            value={selected.color}
            onChange={(e) => updateSelectedText({ color: e.target.value })}
          />
        </Box>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={selected.backgroundColor != null}
              onChange={(e) =>
                updateSelectedText({ backgroundColor: e.target.checked ? (selected.backgroundColor ?? DEFAULT_BG) : undefined })
              }
            />
          }
          label={<Typography variant="body2">배경</Typography>}
        />
        {selected.backgroundColor != null && (
          <TextField
            type="color" size="small" sx={{ width: 60 }}
            value={selected.backgroundColor}
            onChange={(e) => updateSelectedText({ backgroundColor: e.target.value })}
          />
        )}
      </Stack>

      {/* 굵게 + 정렬 */}
      <Stack direction="row" spacing={2} sx={{ mb: 1.5, alignItems: 'center' }}>
        <FormControlLabel
          control={
            <Checkbox
              size="small"
              checked={selected.bold}
              onChange={(e) => updateSelectedText({ bold: e.target.checked })}
            />
          }
          label={<Typography variant="body2">굵게</Typography>}
        />
        <ToggleButtonGroup
          size="small"
          exclusive
          value={selected.align}
          onChange={(_, v) => v && updateSelectedText({ align: v as TextAlign })}
        >
          <ToggleButton value="left"><FormatAlignLeftIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="center"><FormatAlignCenterIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="right"><FormatAlignRightIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Stack>

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

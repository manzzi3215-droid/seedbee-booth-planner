import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Rotate90DegreesCwRoundedIcon from '@mui/icons-material/Rotate90DegreesCwRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useEditor } from './EditorContext';
import { getShapeLabel } from '../fixtures/shapes';
import { isFixtureOutOfBounds } from '../canvas/fixtureGeometry';

/**
 * 오른쪽 선택 정보 패널.
 * 선택된 배치 집기의 정보 표시 + 위치/회전 직접 입력 + 회전/복사/삭제 액션.
 */
export default function SelectionPanel() {
  const {
    placed,
    selectedId,
    fixturesById,
    project,
    rotateSelected,
    copySelected,
    deleteSelected,
    setSelectedPosition,
    setSelectedRotation,
  } = useEditor();

  const selected = placed.find((p) => p.id === selectedId) ?? null;
  const def = selected ? fixturesById.get(selected.fixtureDefId) : null;

  // 위치/회전 직접 입력용 로컬 상태 (선택 집기 값 변화 시 동기화)
  const [xStr, setXStr] = useState('');
  const [yStr, setYStr] = useState('');
  const [rotStr, setRotStr] = useState('');

  useEffect(() => {
    if (selected) {
      setXStr(String(Math.round(selected.xMm)));
      setYStr(String(Math.round(selected.yMm)));
      setRotStr(String(selected.rotationDeg));
    }
  }, [selected?.id, selected?.xMm, selected?.yMm, selected?.rotationDeg, selected]);

  if (!selected || !def) {
    return (
      <Box sx={{ p: 2, height: '100%' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>
          선택 정보
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            color: 'text.secondary',
            mt: 6,
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 40 }} />
          <Typography variant="body2">선택된 집기가 없습니다</Typography>
        </Box>
      </Box>
    );
  }

  const booth = project?.boothConfig;
  const oob =
    booth != null &&
    isFixtureOutOfBounds(selected, def, booth.widthMm, booth.depthMm);

  const applyTransform = () => {
    const x = Number(xStr);
    const y = Number(yStr);
    const rot = Number(rotStr);
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      setSelectedPosition(x, y);
    }
    if (!Number.isNaN(rot)) {
      setSelectedRotation(rot);
    }
  };

  const onFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyTransform();
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
        선택 정보
      </Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: 0.75,
            bgcolor: def.color,
            border: '1px solid rgba(0,0,0,0.2)',
          }}
        />
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
          {def.name}
        </Typography>
      </Stack>
      <Chip
        label={getShapeLabel(def.shape)}
        size="small"
        variant="outlined"
        sx={{ alignSelf: 'flex-start', mb: 1 }}
      />

      {oob && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          집기가 부스 영역을 벗어났습니다.
        </Alert>
      )}

      <Divider sx={{ my: 1 }} />

      <Stack direction="row" sx={{ justifyContent: 'space-between', py: 0.5 }}>
        <Typography variant="body2" color="text.secondary">
          가로×세로×높이
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {def.widthMm}×{def.depthMm}×{def.heightMm ?? '-'} mm
        </Typography>
      </Stack>

      <Divider sx={{ my: 1 }} />

      {/* 위치/회전 직접 입력 */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
        위치 · 회전 직접 입력
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          label="X"
          type="number"
          size="small"
          value={xStr}
          onChange={(e) => setXStr(e.target.value)}
          onKeyDown={onFieldKeyDown}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }}
        />
        <TextField
          label="Y"
          type="number"
          size="small"
          value={yStr}
          onChange={(e) => setYStr(e.target.value)}
          onKeyDown={onFieldKeyDown}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }}
        />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'stretch' }}>
        <TextField
          label="회전"
          type="number"
          size="small"
          value={rotStr}
          onChange={(e) => setRotStr(e.target.value)}
          onKeyDown={onFieldKeyDown}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">°</InputAdornment> } }}
        />
        <Button variant="contained" size="small" onClick={applyTransform} sx={{ flex: 1 }}>
          적용
        </Button>
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Stack spacing={1}>
        <Button
          variant="outlined"
          startIcon={<Rotate90DegreesCwRoundedIcon />}
          onClick={rotateSelected}
          fullWidth
        >
          90도 회전
        </Button>
        <Button
          variant="outlined"
          startIcon={<ContentCopyRoundedIcon />}
          onClick={copySelected}
          fullWidth
        >
          복사
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineRoundedIcon />}
          onClick={deleteSelected}
          fullWidth
        >
          삭제
        </Button>
      </Stack>
    </Box>
  );
}

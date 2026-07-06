import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Slider from '@mui/material/Slider';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CenterFocusStrongRoundedIcon from '@mui/icons-material/CenterFocusStrongRounded';
import { useEditor } from '../editor/EditorContext';

/**
 * Drawing Manager (v0.9.6) — 프로젝트 도면(Background Layer) 관리.
 * 썸네일 · 이름 · 투명도 · 잠금 · 삭제 · 선택. 도면은 배치안에 저장(Cloud/Auto Save/Undo 자동).
 */
export default function DrawingsPanel() {
  const { planBackgrounds, selectBackground, updatePlanBackground, deleteBackground, openImportWizard, canEdit } = useEditor();

  return (
    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>도면 (Drawings)</Typography>
        <Chip label={`${planBackgrounds.length}개`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
      </Stack>

      <Button variant="contained" size="small" fullWidth startIcon={<AddPhotoAlternateRoundedIcon />} onClick={openImportWizard} disabled={!canEdit} sx={{ mb: 1 }}>
        도면 가져오기 (PDF/이미지)
      </Button>

      <Stack spacing={1} sx={{ overflowY: 'auto', pr: 0.5 }}>
        {planBackgrounds.map((bg) => (
          <Paper key={bg.id} elevation={0} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 0.75, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: '#f1f5f9' }}>
                <img src={bg.srcDataUrl} alt={bg.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700 }} title={bg.name}>{bg.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {(bg.widthMm / 1000).toFixed(1)}×{(bg.heightMm / 1000).toFixed(1)}m
                </Typography>
              </Box>
              <Tooltip title="선택/이동">
                <IconButton size="small" onClick={() => selectBackground(bg.id)}><CenterFocusStrongRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
              </Tooltip>
              <Tooltip title={bg.locked ? '잠금 해제' : '잠금'}>
                <IconButton size="small" onClick={() => updatePlanBackground(bg.id, { locked: !bg.locked })}>
                  {bg.locked ? <LockRoundedIcon sx={{ fontSize: 16 }} /> : <LockOpenRoundedIcon sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
              <Tooltip title="삭제">
                <IconButton size="small" color="error" onClick={() => deleteBackground(bg.id)}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ minWidth: 40 }}>투명도</Typography>
              <Slider size="small" min={0} max={1} step={0.05} value={bg.opacity} onChange={(_, v) => updatePlanBackground(bg.id, { opacity: v as number })} />
            </Stack>
          </Paper>
        ))}
        {planBackgrounds.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            가져온 도면이 없습니다. 실제 행사장 도면(PDF/이미지)을 가져와 그 위에 설계하세요.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

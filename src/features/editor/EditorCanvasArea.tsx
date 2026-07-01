import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import { useNavigate } from 'react-router-dom';
import { useEditor } from './EditorContext';
import BoothCanvas from '../canvas/BoothCanvas';
import EditorToolbar from './EditorToolbar';
import { getBoothSizeLabel, getFloorLabel } from '../../constants/booth';

/**
 * 편집기 중앙 영역: 프로젝트 요약 + 2D 캔버스(배치 상호작용).
 */
export default function EditorCanvasArea() {
  const navigate = useNavigate();
  const {
    project,
    projectLoading,
    placed,
    fixturesById,
    selectedId,
    gridSizeMm,
    select,
    move,
  } = useEditor();

  if (projectLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          프로젝트를 찾을 수 없습니다
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          삭제되었거나 잘못된 주소일 수 있습니다.
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/projects')}>
          프로젝트 목록으로
        </Button>
      </Box>
    );
  }

  const { boothConfig } = project;

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
          {project.name}
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip label={`치수 ${getBoothSizeLabel(boothConfig)}`} />
          <Chip variant="outlined" label={`오픈 ${boothConfig.openSide}면`} />
          <Chip variant="outlined" label={`바닥 ${getFloorLabel(boothConfig)}`} />
        </Stack>
      </Paper>

      {/* 단축키 안내 */}
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: 'center', color: 'text.secondary', mb: 1, px: 0.5 }}
      >
        <KeyboardRoundedIcon sx={{ fontSize: 16 }} />
        <Typography variant="caption">
          Delete 삭제 · R 회전 · Ctrl+D 복사 · 방향키 이동(100mm) · Shift+방향키 500mm
        </Typography>
      </Stack>

      <EditorToolbar />

      <Box sx={{ flex: 1, minHeight: 0 }}>
        <BoothCanvas
          booth={boothConfig}
          placed={placed}
          fixturesById={fixturesById}
          selectedId={selectedId}
          gridSizeMm={gridSizeMm}
          onSelect={select}
          onMove={move}
        />
      </Box>
    </Box>
  );
}

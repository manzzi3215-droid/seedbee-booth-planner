import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import { useNavigate } from 'react-router-dom';

/**
 * 홈(시작) 화면.
 * 주요 진입점: [새 프로젝트 만들기] / [프로젝트 목록 보기]
 */
export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 820, mx: 'auto' }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 5 },
          border: '1px solid',
          borderColor: 'divider',
          textAlign: 'center',
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
          Booth Layout Planner
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          백화점 · 박람회 · 팝업스토어 부스를 누구나 쉽게 설계하는 2D 레이아웃 플래너
        </Typography>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'center' }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigate('/projects/new')}
          >
            새 프로젝트 만들기
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<FolderRoundedIcon />}
            onClick={() => navigate('/projects')}
          >
            프로젝트 목록 보기
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { useNavigate } from 'react-router-dom';
import type { Project } from '../types';
import { storage } from '../storage';

/**
 * 홈(시작) 화면.
 * 주요 진입점: [이어서 작업하기](최근 프로젝트) / [새 프로젝트 만들기] / [프로젝트 목록 보기]
 */
export default function HomePage() {
  const navigate = useNavigate();
  // 앱 실행 시 저장소(Firestore/LocalStorage)에서 최근 프로젝트를 자동으로 가져옵니다.
  const [recent, setRecent] = useState<Project | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const projects = await storage.getProjects(); // 최근 수정 순 정렬
      if (active) setRecent(projects[0] ?? null);
    })();
    return () => {
      active = false;
    };
  }, []);

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

        {recent && (
          <Paper
            variant="outlined"
            sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2, textAlign: 'left', bgcolor: 'action.hover' }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                이어서 작업하기
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
                {recent.name}
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<PlayArrowRoundedIcon />}
              onClick={() => navigate(`/projects/${recent.id}/editor`)}
            >
              열기
            </Button>
          </Paper>
        )}

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ justifyContent: 'center' }}
        >
          <Button
            variant={recent ? 'outlined' : 'contained'}
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

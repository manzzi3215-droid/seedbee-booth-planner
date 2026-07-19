import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import type { Project } from '../types';
import { storage, storageProviderName } from '../storage';
import { useAuthUser } from '../firebase/useAuthUser';
import { signInWithGoogle } from '../firebase/auth';

const EditorRoute = lazy(() => import('./EditorRoute'));

type State = 'loading' | 'need-login' | 'invalid' | 'ok';

/**
 * 공유 링크 진입 라우트 (/share/:shareId).
 *  1) 클라우드면 Google 로그인 필요(익명/미로그인 → 로그인 유도)
 *  2) shareId 로 프로젝트 조회 → 없으면 "유효하지 않은 링크"
 *  3) 권한(view/edit)에 따라 읽기전용/편집 에디터로 진입
 */
export default function ShareRoute() {
  const { shareId } = useParams();
  const navigate = useNavigate();
  const { user, ready } = useAuthUser();
  const [state, setState] = useState<State>('loading');
  const [project, setProject] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !shareId) return;
    // Firebase provider 는 공유 조회에 Google 로그인(비익명) 필요.
    // Supabase provider 는 get_project_by_share_token RPC 로 비로그인 조회 허용(로그인 게이트 없음).
    if (storageProviderName === 'firebase' && (!user || user.isAnonymous)) {
      setState('need-login');
      return;
    }
    let active = true;
    setState('loading');
    (async () => {
      const p = await storage.getProjectByShareId(shareId);
      if (!active) return;
      if (!p) setState('invalid');
      else {
        setProject(p);
        setState('ok');
      }
    })();
    return () => {
      active = false;
    };
  }, [ready, user, shareId]);

  const handleLogin = async () => {
    setBusy(true);
    try {
      await signInWithGoogle(); // 성공 시 내부에서 새로고침
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') {
    return (
      <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (state === 'need-login') {
    return (
      <CenterCard>
        <LoginRoundedIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          공유 링크 열기
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          이 프로젝트를 열려면 Google 로그인이 필요합니다.
        </Typography>
        <Button variant="contained" startIcon={<LoginRoundedIcon />} onClick={handleLogin} disabled={busy}>
          Google로 로그인
        </Button>
      </CenterCard>
    );
  }

  if (state === 'invalid') {
    return (
      <CenterCard>
        <LinkOffRoundedIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          공유 링크가 유효하지 않습니다
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          링크가 만료되었거나 비활성화되었을 수 있습니다.
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/')}>
          홈으로
        </Button>
      </CenterCard>
    );
  }

  // ok
  return (
    <Suspense
      fallback={
        <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      }
    >
      <EditorRoute projectIdOverride={project!.id} readOnly={project!.sharePermission !== 'edit'} />
    </Suspense>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={0} sx={{ p: 5, border: '1px solid', borderColor: 'divider', textAlign: 'center', maxWidth: 420 }}>
        {children}
      </Paper>
    </Box>
  );
}

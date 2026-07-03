import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import { useAuthUser } from '../../firebase/useAuthUser';
import { signInWithGoogle, signOutUser } from '../../firebase/auth';

/**
 * 헤더의 로그인 상태 + [Google로 로그인] / [로그아웃] 버튼.
 * - 클라우드 미설정: "로컬 저장" 칩만 표시 (LocalStorage 전용).
 * - 익명 사용자: "게스트" + [Google로 로그인].
 * - Google 사용자: 아바타/이름 + [로그아웃].
 */
export default function AuthButton() {
  const { user, ready, cloud } = useAuthUser();
  const [busy, setBusy] = useState(false);

  if (!cloud) {
    return (
      <Tooltip title="Firebase 미설정 — 이 브라우저에만 저장됩니다">
        <Chip label="로컬 저장" size="small" variant="outlined" sx={{ height: 24 }} />
      </Tooltip>
    );
  }
  if (!ready) return <CircularProgress size={18} sx={{ mr: 1 }} />;

  const isGoogle = !!user && !user.isAnonymous;

  const handleLogin = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch {
      window.alert('Google 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true);
    try {
      await signOutUser();
    } finally {
      setBusy(false);
    }
  };

  if (isGoogle) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CloudDoneRoundedIcon fontSize="small" color="success" />
        <Avatar src={user?.photoURL ?? undefined} sx={{ width: 26, height: 26 }}>
          {(user?.displayName ?? user?.email ?? '?').slice(0, 1)}
        </Avatar>
        <Box sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: 160 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1 }} noWrap>
            {user?.displayName ?? '로그인됨'}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.1 }} noWrap>
            {user?.email ?? ''}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          startIcon={<LogoutRoundedIcon />}
          onClick={handleLogout}
          disabled={busy}
        >
          로그아웃
        </Button>
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <Chip label="게스트" size="small" variant="outlined" sx={{ height: 24 }} />
      <Button
        size="small"
        variant="contained"
        startIcon={<LoginRoundedIcon />}
        onClick={handleLogin}
        disabled={busy}
      >
        Google로 로그인
      </Button>
    </Stack>
  );
}

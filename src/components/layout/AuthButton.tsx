import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import ArrowDropDownRoundedIcon from '@mui/icons-material/ArrowDropDownRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import { useAuthUser } from '../../firebase/useAuthUser';
import { signInWithGoogle, signOutUser } from '../../firebase/auth';
import { useSupabaseAuthUser } from '../../supabase/useSupabaseAuthUser';
import {
  linkGoogleIdentity,
  signInWithGoogleSupabase,
  signOutSupabase,
  currentUserHasData,
} from '../../supabase/auth';
import { storageProviderName } from '../../storage';

/**
 * 헤더의 로그인 상태 표시.
 * - local provider(또는 클라우드 미설정): "로컬 저장" 칩만 (LocalStorage 전용).
 * - firebase provider: 익명 → "게스트" + [Google로 로그인] / Google → 아바타 + [로그아웃].
 * - supabase provider: 익명 → "게스트·클라우드" + [Google ▾] 메뉴(연결 / 기존 로그인) /
 *   Google 연결됨 → 아바타·이름·이메일 + [로그아웃].
 */
export default function AuthButton() {
  // 두 훅 모두 항상 호출(React 훅 규칙). 비활성 provider 쪽은 내부에서 no-op.
  const fb = useAuthUser();
  const supa = useSupabaseAuthUser();
  const [busy, setBusy] = useState(false);
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const oauthErrorShown = useRef(false);

  // OAuth 리다이렉트 복귀 시 오류 표시 후 URL 정리. ref 가드로 중복 표시 방지(StrictMode 포함).
  //  - identity_already_exists: 이미 등록된 계정 → "기존 계정으로 로그인" 안내
  //  - access_denied(취소): 조용히 복귀
  useEffect(() => {
    if (storageProviderName !== 'supabase' || oauthErrorShown.current) return;
    const q = new URLSearchParams(window.location.search);
    const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const code = q.get('error') ?? h.get('error') ?? q.get('error_code') ?? h.get('error_code');
    const desc = q.get('error_description') ?? h.get('error_description');
    if (!code && !desc) return;
    oauthErrorShown.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    const cancelled = /access_denied/i.test(code ?? '') || /cancel|denied/i.test(desc ?? '');
    const already = /already/i.test(desc ?? '') || /identity_already_exists|already_exists/i.test(code ?? '');
    if (cancelled) return; // 사용자 취소 — 조용히 복귀
    window.alert(
      already
        ? '이미 등록된 Google 계정입니다. "기존 Google 계정으로 로그인"을 사용해 주세요.'
        : 'Google 인증에 실패했습니다: ' + (desc ?? code),
    );
  }, []);

  // ----- Supabase provider -----
  if (storageProviderName === 'supabase') {
    if (!supa.ready) return <CircularProgress size={18} sx={{ mr: 1 }} />;
    const su = supa.user;
    const isGoogle = !!su && !su.isAnonymous;

    const closeMenu = () => setMenuEl(null);

    // 1) 이 게스트 작업을 Google 에 연결 (linkIdentity — uid 유지)
    const handleLink = async () => {
      closeMenu();
      setBusy(true);
      try {
        await linkGoogleIdentity(); // 성공 시 Google 로 리다이렉트
      } catch {
        setBusy(false);
        window.alert('Google 계정 연결을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    };

    // 2) 기존 Google 계정으로 로그인 (signInWithOAuth — uid 전환). 게스트 데이터가 있으면 경고.
    const handleSignInExisting = async () => {
      closeMenu();
      setBusy(true);
      try {
        const hasData = await currentUserHasData();
        if (hasData) {
          const ok = window.confirm(
            '기존 Google 계정으로 로그인하면 현재 게스트 작업은 자동으로 합쳐지지 않습니다. ' +
              '필요한 작업은 먼저 "이 게스트 작업을 Google에 연결"하거나 별도로 보관해 주세요.\n\n계속하시겠습니까?',
          );
          if (!ok) {
            setBusy(false);
            return; // 사용자 미확인 — 전환하지 않음
          }
        }
        await signInWithGoogleSupabase(); // 성공 시 Google 로 리다이렉트
      } catch {
        setBusy(false);
        window.alert('로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    };

    const handleSupaLogout = async () => {
      setBusy(true);
      try {
        await signOutSupabase();
      } finally {
        setBusy(false);
      }
    };

    if (isGoogle) {
      return (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CloudDoneRoundedIcon fontSize="small" color="success" />
          <Avatar src={su?.photoURL ?? undefined} sx={{ width: 26, height: 26 }}>
            {(su?.displayName ?? su?.email ?? '?').slice(0, 1)}
          </Avatar>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: 160 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', lineHeight: 1.1 }} noWrap>
              {su?.displayName ?? '로그인됨'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.1 }} noWrap>
              {su?.email ?? ''}
            </Typography>
          </Box>
          <Button size="small" variant="outlined" color="inherit" startIcon={<LogoutRoundedIcon />} onClick={handleSupaLogout} disabled={busy}>
            로그아웃
          </Button>
        </Stack>
      );
    }

    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <Tooltip title="Supabase 클라우드에 저장됩니다 (게스트/익명)">
          <Chip icon={<CloudDoneRoundedIcon />} label="게스트 · 클라우드" size="small" variant="outlined" sx={{ height: 24 }} />
        </Tooltip>
        <Button
          size="small"
          variant="contained"
          startIcon={<LoginRoundedIcon />}
          endIcon={<ArrowDropDownRoundedIcon />}
          onClick={(e) => setMenuEl(e.currentTarget)}
          disabled={busy}
        >
          Google
        </Button>
        <Menu anchorEl={menuEl} open={Boolean(menuEl)} onClose={closeMenu}>
          <MenuItem onClick={handleLink}>
            <ListItemIcon>
              <LinkRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="이 게스트 작업을 Google에 연결"
              secondary="현재 작업·소유권 유지 · 새 Google 계정용"
            />
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleSignInExisting}>
            <ListItemIcon>
              <LoginRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="기존 Google 계정으로 로그인"
              secondary="이미 연결된 계정 · 다른 기기·데이터 복구용"
            />
          </MenuItem>
        </Menu>
      </Stack>
    );
  }

  // ----- Firebase / local provider -----
  const { user, ready, cloud } = fb;
  if (!cloud) {
    return (
      <Tooltip title="클라우드 미설정 — 이 브라우저에만 저장됩니다">
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

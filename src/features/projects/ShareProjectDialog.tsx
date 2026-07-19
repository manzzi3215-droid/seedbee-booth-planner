import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import type { Project, SharePermission } from '../../types';
import { storage, storageProviderName } from '../../storage';
import { getSharedWith, isValidEmail, normalizeEmails } from '../../utils/project';
import { generateId } from '../../utils/id';

/**
 * 프로젝트 공유 다이얼로그 — 이메일 공유 / 링크 공유 탭.
 *  - 이메일 공유: sharedWith 이메일 편집 (읽기+편집)
 *  - 링크 공유: 공유 링크 생성/복사/비활성화 + 권한(보기만/수정 가능)
 */
export default function ShareProjectDialog({
  open,
  project,
  currentEmail,
  onClose,
  onSaved,
}: {
  open: boolean;
  project: Project | null;
  currentEmail: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState(0);
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // 링크 공유 상태
  const [shareId, setShareId] = useState<string | undefined>(undefined);
  const [shareEnabled, setShareEnabled] = useState(false);
  const [permission, setPermission] = useState<SharePermission>('view');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && project) {
      setTab(0);
      setEmails(getSharedWith(project));
      setInput('');
      setError(null);
      setShareId(project.shareId);
      setShareEnabled(project.shareEnabled ?? false);
      setPermission(project.sharePermission ?? 'view');
      setCopied(false);
    }
  }, [open, project]);

  if (!project) return null;

  // 이메일 공유는 Firebase(Google 이메일 매칭) 전제 기능. Supabase provider 에서는 아직 미지원.
  const isSupabase = storageProviderName === 'supabase';
  const shareLink = shareId ? `${window.location.origin}/share/${shareId}` : '';

  // 이메일 + 링크 상태를 함께 저장
  const persist = async (share: {
    shareId: string | undefined;
    shareEnabled: boolean;
    sharePermission: SharePermission;
  }) => {
    setSaving(true);
    try {
      const sharedWith = normalizeEmails(emails);
      await storage.saveProject({
        ...project,
        sharedWith,
        visibility: sharedWith.length > 0 ? 'shared' : 'private',
        shareId: share.shareId,
        shareEnabled: share.shareEnabled,
        sharePermission: share.sharePermission,
        updatedAt: Date.now(),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  // --- 이메일 공유 ---
  const addEmail = () => {
    const e = input.trim().toLowerCase();
    if (!e) return;
    if (!isValidEmail(e)) return setError('올바른 이메일 형식이 아닙니다.');
    if (currentEmail && e === currentEmail.toLowerCase()) return setError('본인 계정은 추가할 필요가 없습니다.');
    if (emails.includes(e)) return setError('이미 추가된 이메일입니다.');
    setEmails([...emails, e]);
    setInput('');
    setError(null);
  };
  const removeEmail = (e: string) => setEmails(emails.filter((x) => x !== e));
  const saveEmails = async () => {
    await persist({ shareId, shareEnabled, sharePermission: permission });
    onClose();
  };

  // --- 링크 공유 ---
  const generateLink = async () => {
    const sid = shareId ?? generateId();
    setShareId(sid);
    setShareEnabled(true);
    await persist({ shareId: sid, shareEnabled: true, sharePermission: permission });
  };
  const disableLink = async () => {
    setShareEnabled(false);
    await persist({ shareId, shareEnabled: false, sharePermission: permission });
  };
  const changePermission = async (perm: SharePermission) => {
    setPermission(perm);
    if (shareEnabled) await persist({ shareId, shareEnabled: true, sharePermission: perm });
  };
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard 권한 없음 — 사용자가 수동 복사 */
    }
  };

  const emailShared = emails.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>
        프로젝트 공유
        <Typography variant="body2" color="text.secondary" noWrap>
          {project.name}
        </Typography>
      </DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, minHeight: 40 }}>
        <Tab icon={<GroupRoundedIcon fontSize="small" />} iconPosition="start" label="이메일 공유" sx={{ minHeight: 40 }} />
        <Tab icon={<LinkRoundedIcon fontSize="small" />} iconPosition="start" label="링크 공유" sx={{ minHeight: 40 }} />
      </Tabs>

      <DialogContent dividers>
        {tab === 0 && isSupabase ? (
          <Alert severity="info">
            현재 <b>Supabase 모드</b>에서는 이메일 직접 공유가 아직 지원되지 않습니다.
            <br />
            <b>링크 공유</b> 탭에서 공유 링크를 만들어 사용하세요. (로그인 없이 열람 가능)
          </Alert>
        ) : tab === 0 ? (
          <>
            <Chip
              size="small"
              color={emailShared ? 'success' : 'default'}
              variant="outlined"
              icon={emailShared ? <GroupRoundedIcon /> : <LockRoundedIcon />}
              label={emailShared ? `공유됨 · ${emails.length}명` : '비공개'}
              sx={{ mb: 2 }}
            />
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <TextField
                label="공유할 Google 이메일"
                placeholder="예) coworker@company.com"
                value={input}
                size="small"
                fullWidth
                error={Boolean(error)}
                helperText={error ?? ' '}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && addEmail()}
              />
              <Button variant="outlined" startIcon={<PersonAddAltRoundedIcon />} onClick={addEmail} sx={{ height: 40 }}>
                추가
              </Button>
            </Stack>
            {emails.length > 0 ? (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {emails.map((e) => (
                  <Chip key={e} label={e} onDelete={() => removeEmail(e)} size="small" />
                ))}
              </Box>
            ) : (
              <Typography variant="caption" color="text.secondary">
                이메일을 추가하면 해당 Google 사용자가 이 프로젝트를 열고 편집할 수 있습니다.
              </Typography>
            )}
            <Alert severity="info" sx={{ mt: 2 }}>
              이메일 공유 대상은 <b>읽기·편집</b>이 가능합니다.
            </Alert>
          </>
        ) : (
          <>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              공유 권한
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={permission}
              onChange={(_, v) => v && changePermission(v as SharePermission)}
              sx={{ mb: 2 }}
            >
              <ToggleButton value="view">보기만 가능</ToggleButton>
              <ToggleButton value="edit">수정 가능</ToggleButton>
            </ToggleButtonGroup>

            {shareEnabled && shareId ? (
              <>
                <Chip size="small" color="success" variant="outlined" icon={<LinkRoundedIcon />} label="링크 활성화됨" sx={{ mb: 1 }} />
                <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
                  <TextField value={shareLink} size="small" fullWidth slotProps={{ input: { readOnly: true } }} />
                  <Tooltip title={copied ? '복사됨!' : '링크 복사'}>
                    <IconButton onClick={copyLink} color={copied ? 'success' : 'default'}>
                      <ContentCopyRoundedIcon />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Button color="error" variant="outlined" size="small" onClick={disableLink} disabled={saving}>
                  링크 비활성화
                </Button>
                <Alert severity="info" sx={{ mt: 2 }}>
                  {isSupabase ? (
                    <>링크 접속자는 <b>로그인 없이</b> {permission === 'edit' ? '수정' : '보기'}만 할 수 있습니다.</>
                  ) : (
                    <>링크 접속자는 <b>Google 로그인</b> 후 {permission === 'edit' ? '수정' : '보기'}만 할 수 있습니다.</>
                  )}
                </Alert>
              </>
            ) : (
              <>
                <Button variant="contained" startIcon={<LinkRoundedIcon />} onClick={generateLink} disabled={saving}>
                  공유 링크 생성
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  링크를 생성하면 <code>/share/…</code> 주소로 {isSupabase ? '로그인 없이' : '로그인한'} 누구나(권한 범위 내) 접근할 수 있습니다.
                </Typography>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          닫기
        </Button>
        {tab === 0 && !isSupabase && (
          <Button variant="contained" onClick={saveEmails} disabled={saving}>
            저장
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

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
import PersonAddAltRoundedIcon from '@mui/icons-material/PersonAddAltRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import type { Project } from '../../types';
import { storage } from '../../storage';
import { getSharedWith, isValidEmail, normalizeEmails } from '../../utils/project';

/**
 * 프로젝트 공유 설정 다이얼로그.
 * - 이메일을 추가/삭제해 sharedWith 를 편집하고 저장합니다.
 * - sharedWith 사용자는 읽기+편집 가능(권한 세분화는 추후 TODO).
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
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && project) {
      setEmails(getSharedWith(project));
      setInput('');
      setError(null);
    }
  }, [open, project]);

  if (!project) return null;

  const addEmail = () => {
    const e = input.trim().toLowerCase();
    if (!e) return;
    if (!isValidEmail(e)) {
      setError('올바른 이메일 형식이 아닙니다.');
      return;
    }
    if (currentEmail && e === currentEmail.toLowerCase()) {
      setError('본인 계정은 추가할 필요가 없습니다.');
      return;
    }
    if (emails.includes(e)) {
      setError('이미 추가된 이메일입니다.');
      return;
    }
    setEmails([...emails, e]);
    setInput('');
    setError(null);
  };

  const removeEmail = (e: string) => setEmails(emails.filter((x) => x !== e));

  const handleSave = async () => {
    setSaving(true);
    try {
      const sharedWith = normalizeEmails(emails);
      await storage.saveProject({
        ...project,
        sharedWith,
        visibility: sharedWith.length > 0 ? 'shared' : 'private',
        updatedAt: Date.now(),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const shared = emails.length > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>프로젝트 공유</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          <b>{project.name}</b>
        </Typography>

        <Chip
          size="small"
          color={shared ? 'success' : 'default'}
          variant="outlined"
          icon={shared ? <GroupRoundedIcon /> : <LockRoundedIcon />}
          label={shared ? `공유됨 · ${emails.length}명` : '비공개'}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') addEmail();
            }}
          />
          <Button variant="outlined" startIcon={<PersonAddAltRoundedIcon />} onClick={addEmail} sx={{ height: 40 }}>
            추가
          </Button>
        </Stack>

        {emails.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
            {emails.map((e) => (
              <Chip key={e} label={e} onDelete={() => removeEmail(e)} size="small" />
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            아직 공유한 사용자가 없습니다. 이메일을 추가하면 해당 사용자가 이 프로젝트를 열고 편집할 수 있습니다.
          </Typography>
        )}

        <Alert severity="info" sx={{ mt: 2 }}>
          공유 대상은 <b>읽기·편집</b>이 가능합니다. (읽기 전용 권한은 추후 지원 예정)
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={saving}>
          취소
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}

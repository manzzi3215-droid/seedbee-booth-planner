import { useEffect, useMemo, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';

export interface Command {
  id: string;
  label: string;
  group: string;
  keywords?: string;
  shortcut?: string;
  disabled?: boolean;
  run: () => void;
}

/**
 * Command Palette (Ctrl+K) — Figma/VSCode 스타일 명령 검색 실행기 (v0.9.5).
 * 모든 주요 기능을 검색해 즉시 실행. 기능이 많아도 찾기 쉽게 만드는 핵심 UI.
 */
export default function CommandPalette({ open, onClose, commands }: { open: boolean; onClose: () => void; commands: Command[] }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = commands.filter((c) => !c.disabled);
    if (!term) return list;
    return list.filter((c) => (c.label + ' ' + c.group + ' ' + (c.keywords ?? '')).toLowerCase().includes(term));
  }, [q, commands]);

  useEffect(() => {
    if (active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  const runAt = (i: number) => {
    const c = filtered[i];
    if (!c) return;
    onClose();
    setTimeout(() => c.run(), 0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(filtered.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runAt(active);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { position: 'fixed', top: 80, m: 0, borderRadius: 2 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
        <SearchRoundedIcon sx={{ color: 'text.secondary', mr: 1 }} />
        <InputBase
          inputRef={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="명령 검색…  (예: 정렬, 3D, 내보내기, Undo)"
          fullWidth
          sx={{ fontSize: 16 }}
        />
        <Chip size="small" label="Esc" variant="outlined" sx={{ ml: 1, height: 20, fontSize: 11 }} />
      </Box>
      <List dense sx={{ maxHeight: '52vh', overflowY: 'auto', py: 0.5 }}>
        {filtered.map((c, i) => (
          <ListItemButton key={c.id} selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => runAt(i)} sx={{ borderRadius: 1, mx: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 0, mr: 1.5 }}>
              <Chip size="small" label={c.group} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
            </ListItemIcon>
            <ListItemText primary={c.label} slotProps={{ primary: { variant: 'body2', sx: { fontWeight: 600 } } }} />
            {c.shortcut && <Chip size="small" label={c.shortcut} sx={{ height: 20, fontSize: 11, bgcolor: 'action.hover' }} />}
          </ListItemButton>
        ))}
        {filtered.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">일치하는 명령이 없습니다.</Typography>
          </Box>
        )}
      </List>
    </Dialog>
  );
}

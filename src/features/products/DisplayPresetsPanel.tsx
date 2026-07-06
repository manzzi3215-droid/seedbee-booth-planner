import { useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import BookmarkAddRoundedIcon from '@mui/icons-material/BookmarkAddRounded';
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded';
import type { ProductPreset } from '../../types';
import { useEditor } from '../editor/EditorContext';
import { sanitizeFilename } from '../export/download';

/**
 * Display Presets (Merchandising Preset System, v0.9.4).
 * 집기의 진열 상태를 프리셋으로 저장하고, 빈 집기에 적용해 몇 초 만에 진열 완성.
 * 프리셋은 프로젝트(행사) 단위 Cloud Save + 내보내기/가져오기로 공유.
 */
export default function DisplayPresetsPanel() {
  const {
    productPresets,
    placedProducts,
    selectedFixtureId,
    saveFixtureAsPreset,
    applyPresetToFixture,
    renamePreset,
    duplicatePreset,
    deletePreset,
    importPreset,
    canEdit,
  } = useEditor();
  const fileRef = useRef<HTMLInputElement>(null);

  const selCount = selectedFixtureId ? placedProducts.filter((p) => p.fixtureId === selectedFixtureId).length : 0;

  const saveCurrent = () => {
    if (!selectedFixtureId) return;
    const name = window.prompt('프리셋 이름을 입력하세요.', '새 프리셋');
    if (name == null) return;
    saveFixtureAsPreset(selectedFixtureId, name.trim() || '새 프리셋');
  };
  const apply = (id: string) => {
    if (!selectedFixtureId) return;
    applyPresetToFixture(selectedFixtureId, id);
  };
  const rename = (p: ProductPreset) => {
    const name = window.prompt('새 이름', p.name);
    if (name == null) return;
    renamePreset(p.id, name.trim() || p.name);
  };
  const exportPreset = (p: ProductPreset) => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `preset_${sanitizeFilename(p.name)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const preset = JSON.parse(await file.text()) as ProductPreset;
      if (preset && Array.isArray(preset.items)) importPreset(preset);
    } catch {
      /* 잘못된 파일 무시 */
    }
  };

  return (
    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>진열 프리셋</Typography>
        <Chip label={`${productPresets.length}개`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
      </Stack>

      {selectedFixtureId ? (
        <Alert severity="info" sx={{ mb: 1, py: 0.25 }}>
          선택 집기에 제품 {selCount}개 — 프리셋 저장/적용 가능
        </Alert>
      ) : (
        <Alert severity="warning" sx={{ mb: 1, py: 0.25 }}>
          집기를 선택하면 프리셋을 저장/적용할 수 있어요.
        </Alert>
      )}

      <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
        <Button size="small" variant="contained" fullWidth startIcon={<BookmarkAddRoundedIcon />} onClick={saveCurrent} disabled={!canEdit || !selectedFixtureId || selCount === 0}>
          현재 진열 저장
        </Button>
        <Tooltip title="프리셋 가져오기">
          <span>
            <IconButton size="small" onClick={() => fileRef.current?.click()} disabled={!canEdit}>
              <FileUploadRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onImport} />
      </Stack>

      <Stack spacing={1} sx={{ overflowY: 'auto', pr: 0.5 }}>
        {productPresets.map((p) => (
          <Paper key={p.id} elevation={0} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap title={p.name}>{p.name}</Typography>
                <Typography variant="caption" color="text.secondary">제품 {p.items.length}개</Typography>
              </Box>
              <Tooltip title="이름 변경"><IconButton size="small" onClick={() => rename(p)}><EditRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title="복제"><IconButton size="small" onClick={() => duplicatePreset(p.id)}><ContentCopyRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title="내보내기"><IconButton size="small" onClick={() => exportPreset(p)}><FileDownloadRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title="삭제"><IconButton size="small" color="error" onClick={() => deletePreset(p.id)}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
            </Stack>
            <Button size="small" variant="outlined" fullWidth startIcon={<PlaylistAddCheckRoundedIcon sx={{ fontSize: 16 }} />} onClick={() => apply(p.id)} disabled={!canEdit || !selectedFixtureId} sx={{ mt: 0.75, py: 0.2 }}>
              선택 집기에 적용
            </Button>
          </Paper>
        ))}
        {productPresets.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            저장된 프리셋이 없습니다. 집기에 제품을 진열한 뒤 "현재 진열 저장"으로 프리셋을 만드세요.
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

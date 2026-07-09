import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { useEditor } from '../editor/EditorContext';
import { countAssetUsage } from './mapping';
import { uploadDesignAsset, deleteDesignAssetFile, isSupportedDesignFile } from '../../firebase/storage';

/**
 * 디자인 에셋 관리 패널 (req #14, #15).
 * 현재 배치안의 디자인 목록: 썸네일 · 파일명 · 사용 집기 수 · 교체 · 삭제.
 * 교체 시 같은 assetId 를 유지하므로 사용 중인 모든 집기가 자동 반영됩니다.
 */
export default function AssetManagerPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const { designAssets, placed, replaceDesignAsset, deleteDesignAsset } = useEditor();
  const usage = countAssetUsage(placed);
  const fileRef = useRef<HTMLInputElement>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [query, setQuery] = useState(''); // 에셋 검색 (v1.0.9)
  const q = query.trim().toLowerCase();
  const shown = q ? designAssets.filter((a) => a.name.toLowerCase().includes(q)) : designAssets;

  // 그룹(embedded) 안에서는 0개여도 안내 문구를 표시(그룹 헤더가 개수를 보여줌)
  if (designAssets.length === 0) {
    return embedded ? (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', py: 1 }}>
        디자인 에셋이 없습니다. 집기에 이미지를 매핑하면 여기에 표시됩니다.
      </Typography>
    ) : null;
  }

  const startReplace = (id: string) => {
    setReplacingId(id);
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !replacingId || !isSupportedDesignFile(file)) return;
    const oldAsset = designAssets.find((a) => a.id === replacingId);
    try {
      const a = await uploadDesignAsset(file);
      // 같은 id 유지 → 사용 중인 모든 집기 자동 반영
      replaceDesignAsset(replacingId, {
        url: a.url,
        storagePath: a.storagePath,
        name: a.name,
        kind: a.kind,
        widthPx: a.widthPx,
        heightPx: a.heightPx,
      });
      if (oldAsset?.storagePath && oldAsset.storagePath !== a.storagePath) {
        void deleteDesignAssetFile(oldAsset.storagePath);
      }
    } catch {
      /* 업로드 실패 — 무시 */
    } finally {
      setReplacingId(null);
    }
  };

  const handleDelete = (id: string, name: string) => {
    const n = usage.get(id) ?? 0;
    if (!window.confirm(`"${name}" 디자인을 삭제할까요?${n > 0 ? `\n사용 중인 집기 ${n}개의 매핑도 함께 제거됩니다.` : ''}`)) return;
    const asset = designAssets.find((a) => a.id === id);
    deleteDesignAsset(id);
    void deleteDesignAssetFile(asset?.storagePath);
  };

  return (
    <Box sx={{ mt: embedded ? 0 : 2 }}>
      {!embedded && (
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
          디자인 에셋 <Chip label={designAssets.length} size="small" variant="outlined" sx={{ height: 18, fontSize: 11 }} />
        </Typography>
      )}
      {designAssets.length > 3 && (
        <TextField
          size="small"
          fullWidth
          placeholder="에셋 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ mb: 1 }}
          slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 18 }} /></InputAdornment>) } }}
        />
      )}
      <Stack spacing={1}>
        {shown.map((a) => (
          <Paper key={a.id} elevation={0} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 40, height: 40, flexShrink: 0, border: '1px solid', borderColor: 'divider', borderRadius: 0.5, overflow: 'hidden', bgcolor: 'action.hover' }}>
                <img src={a.url} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap title={a.name} sx={{ fontWeight: 600 }}>
                  {a.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  사용 {usage.get(a.id) ?? 0}개 · {a.kind.toUpperCase()}
                </Typography>
              </Box>
              <Tooltip title="교체">
                <IconButton size="small" onClick={() => startReplace(a.id)}>
                  <SwapHorizRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="삭제">
                <IconButton size="small" color="error" onClick={() => handleDelete(a.id, a.name)}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
        style={{ display: 'none' }}
        onChange={onFile}
      />
    </Box>
  );
}

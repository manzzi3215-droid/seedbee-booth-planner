import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import InputAdornment from '@mui/material/InputAdornment';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddLocationAltRoundedIcon from '@mui/icons-material/AddLocationAltRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import type { Asset, AssetCategory, AssetVisibility } from '../../types';
import { useEditor } from '../editor/EditorContext';
import { uploadDesignAsset, isSupportedDesignFile } from '../../firebase/storage';
import { ASSET_CATEGORIES, categoryMeta, categoryLabel } from './assetModel';
import { generateId } from '../../utils/id';

type ScopeFilter = 'all' | 'private' | 'company';
type CategoryFilter = AssetCategory | 'all' | 'favorite' | 'recent';

const emptyDraft = (): Asset => {
  const meta = categoryMeta('furniture');
  return {
    id: generateId(),
    name: '',
    category: 'furniture',
    widthMm: meta.widthMm,
    depthMm: meta.depthMm,
    heightMm: meta.heightMm,
    color: meta.color,
    modelType: meta.modelType,
    visibility: 'private',
    version: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
};

/** 에셋 썸네일 (이미지 또는 카테고리 아이콘 폴백) */
function AssetThumb({ asset, size }: { asset: Asset; size: number }) {
  const meta = categoryMeta(asset.category);
  const img = asset.thumbnailUrl ?? asset.previewImageUrl;
  return (
    <Box
      sx={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: 0.75,
        overflow: 'hidden',
        bgcolor: img ? '#fff' : asset.color || meta.color,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.5,
      }}
    >
      {img ? (
        <img src={img} alt={asset.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : (
        <span>{meta.icon}</span>
      )}
    </Box>
  );
}

/**
 * Asset Library 2.0 (v0.9.7).
 * 자주 쓰는 집기·소품·POP·제품·사람·식물·조명 등을 라이브러리에서 바로 배치.
 * My(개인) / Company(회사 공용) 구분, 카테고리·검색·즐겨찾기·최근 필터, 등록/수정/삭제.
 * 배치는 기존 집기+디자인 매핑 파이프라인을 재사용해 2D/3D 자동 반영.
 */
export default function AssetLibraryPanel() {
  const {
    assets,
    saveAsset,
    deleteAsset,
    toggleAssetFavorite,
    recentAssetIds,
    placeAsset,
    createAssetFromFixture,
    selectedFixtureId,
    canEdit,
  } = useEditor();

  const [scope, setScope] = useState<ScopeFilter>('all');
  const [cat, setCat] = useState<CategoryFilter>('all');
  const [q, setQ] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Asset>(emptyDraft());
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const openAdd = () => {
    setDraft(emptyDraft());
    setEditing(false);
    setDialogOpen(true);
  };
  const openEdit = (a: Asset) => {
    setDraft({ ...a });
    setEditing(true);
    setDialogOpen(true);
  };
  const patch = (p: Partial<Asset>) => setDraft((d) => ({ ...d, ...p }));

  const saveSelectedFixtureAsAsset = () => {
    if (!selectedFixtureId) return;
    const a = createAssetFromFixture(selectedFixtureId);
    if (!a) return;
    setDraft(a); // 새 에셋으로 등록(수정 아님) — 카테고리/치수 확인 후 저장
    setEditing(false);
    setDialogOpen(true);
  };

  const onCategoryChange = (category: AssetCategory) => {
    const meta = categoryMeta(category);
    // 새 에셋(미편집)일 때만 카테고리 기본 치수/색을 함께 반영
    patch(
      editing
        ? { category }
        : { category, widthMm: meta.widthMm, depthMm: meta.depthMm, heightMm: meta.heightMm, color: meta.color, modelType: meta.modelType },
    );
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isSupportedDesignFile(file)) return;
    setUploading(true);
    try {
      const a = await uploadDesignAsset(file); // 경량 dataURL 반환(재사용). Storage 참조 전환 대비 필드 유지.
      patch({ thumbnailUrl: a.url });
    } catch {
      /* 무시 */
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!draft.name.trim()) return;
    const tags = (draft.tags ?? []).map((t) => t.trim()).filter(Boolean);
    const clean: Asset = { ...draft, name: draft.name.trim(), tags, updatedAt: Date.now() };
    await saveAsset(clean);
    setDialogOpen(false);
  };

  const handleDelete = async (a: Asset) => {
    if (!window.confirm(`"${a.name}" 에셋을 라이브러리에서 삭제할까요?`)) return;
    await deleteAsset(a.id);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = assets;
    if (scope !== 'all') list = list.filter((a) => a.visibility === scope);
    if (cat === 'favorite') list = list.filter((a) => a.favorite);
    else if (cat === 'recent') list = list.filter((a) => recentAssetIds.includes(a.id));
    else if (cat !== 'all') list = list.filter((a) => a.category === cat);
    if (query) {
      list = list.filter((a) =>
        [a.name, a.brand, categoryLabel(a.category), ...(a.tags ?? [])]
          .filter(Boolean)
          .some((s) => s!.toLowerCase().includes(query)),
      );
    }
    if (cat === 'recent') {
      // 최근순 유지
      return [...list].sort((x, y) => recentAssetIds.indexOf(x.id) - recentAssetIds.indexOf(y.id));
    }
    return list;
  }, [assets, scope, cat, q, recentAssetIds]);

  return (
    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          에셋 라이브러리
        </Typography>
        <Chip label={`${assets.length}개`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
      </Stack>

      <ToggleButtonGroup
        size="small"
        exclusive
        fullWidth
        value={scope}
        onChange={(_, v) => v && setScope(v)}
        sx={{ mb: 1, '& .MuiToggleButton-root': { py: 0.25, fontSize: 12 } }}
      >
        <ToggleButton value="all">전체</ToggleButton>
        <ToggleButton value="private">내 라이브러리</ToggleButton>
        <ToggleButton value="company">회사</ToggleButton>
      </ToggleButtonGroup>

      <Button variant="contained" size="small" fullWidth startIcon={<AddRoundedIcon />} onClick={openAdd} sx={{ mb: 1 }} disabled={!canEdit}>
        에셋 등록
      </Button>

      {selectedFixtureId && (
        <Button variant="outlined" size="small" fullWidth onClick={saveSelectedFixtureAsAsset} sx={{ mb: 1 }} disabled={!canEdit}>
          선택한 집기를 에셋으로 저장
        </Button>
      )}

      <TextField
        size="small"
        placeholder="이름·태그·브랜드 검색"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 1 }}
        slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 18 }} /></InputAdornment>) } }}
      />

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        <Chip label="전체" size="small" color={cat === 'all' ? 'primary' : 'default'} variant={cat === 'all' ? 'filled' : 'outlined'} onClick={() => setCat('all')} sx={{ height: 22, fontSize: 11 }} />
        <Chip label="⭐ 즐겨찾기" size="small" color={cat === 'favorite' ? 'primary' : 'default'} variant={cat === 'favorite' ? 'filled' : 'outlined'} onClick={() => setCat('favorite')} sx={{ height: 22, fontSize: 11 }} />
        <Chip label="🕘 최근" size="small" color={cat === 'recent' ? 'primary' : 'default'} variant={cat === 'recent' ? 'filled' : 'outlined'} onClick={() => setCat('recent')} sx={{ height: 22, fontSize: 11 }} />
        {ASSET_CATEGORIES.map((c) => (
          <Chip
            key={c.key}
            label={`${c.icon} ${c.label}`}
            size="small"
            color={cat === c.key ? 'primary' : 'default'}
            variant={cat === c.key ? 'filled' : 'outlined'}
            onClick={() => setCat(c.key)}
            sx={{ height: 22, fontSize: 11 }}
          />
        ))}
      </Box>

      <Stack spacing={1} sx={{ overflowY: 'auto', pr: 0.5, flex: 1, minHeight: 0 }}>
        {filtered.map((a) => (
          <Paper key={a.id} elevation={0} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <AssetThumb asset={a} size={40} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700 }} title={a.name}>
                  {a.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {categoryLabel(a.category)} · {a.widthMm}×{a.depthMm}
                  {a.heightMm ? `×${a.heightMm}` : ''}mm
                </Typography>
              </Box>
              <Chip
                label={a.visibility === 'company' ? '회사' : '개인'}
                size="small"
                variant="outlined"
                color={a.visibility === 'company' ? 'info' : 'default'}
                sx={{ height: 18, fontSize: 10 }}
              />
              <Tooltip title={a.favorite ? '즐겨찾기 해제' : '즐겨찾기'}>
                <IconButton size="small" onClick={() => void toggleAssetFavorite(a.id)}>
                  {a.favorite ? <StarRoundedIcon sx={{ fontSize: 18, color: '#f5b400' }} /> : <StarBorderRoundedIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
              <Button size="small" variant="contained" startIcon={<AddLocationAltRoundedIcon sx={{ fontSize: 15 }} />} onClick={() => placeAsset(a)} disabled={!canEdit} sx={{ py: 0.2, flex: 1 }}>
                배치
              </Button>
              <Tooltip title="수정"><IconButton size="small" onClick={() => openEdit(a)} disabled={!canEdit}><EditRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title="삭제"><IconButton size="small" color="error" onClick={() => void handleDelete(a)} disabled={!canEdit}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
            </Stack>
          </Paper>
        ))}
        {filtered.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            조건에 맞는 에셋이 없습니다. 에셋을 등록해 라이브러리를 채워보세요.
          </Typography>
        )}
      </Stack>

      {/* 에셋 등록/수정 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '에셋 수정' : '에셋 등록'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <AssetThumb asset={draft} size={72} />
              <Stack spacing={0.5}>
                <Button size="small" startIcon={<CloudUploadRoundedIcon />} onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '업로드 중…' : '이미지 업로드 (PNG/JPG/SVG/WEBP)'}
                </Button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" style={{ display: 'none' }} onChange={handleImage} />
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">색상</Typography>
                  <input type="color" value={draft.color ?? '#cbd5e1'} onChange={(e) => patch({ color: e.target.value })} style={{ width: 32, height: 26, border: 'none', background: 'none', cursor: 'pointer' }} />
                </Stack>
              </Stack>
            </Stack>

            <TextField size="small" label="에셋명 *" value={draft.name} onChange={(e) => patch({ name: e.target.value })} autoFocus />
            <Stack direction="row" spacing={1}>
              <TextField size="small" select label="카테고리" value={draft.category} onChange={(e) => onCategoryChange(e.target.value as AssetCategory)} fullWidth>
                {ASSET_CATEGORIES.map((c) => <MenuItem key={c.key} value={c.key}>{c.icon} {c.label}</MenuItem>)}
              </TextField>
              <TextField size="small" select label="공개 범위" value={draft.visibility} onChange={(e) => patch({ visibility: e.target.value as AssetVisibility })} fullWidth>
                <MenuItem value="private">개인 (My)</MenuItem>
                <MenuItem value="company">회사 (Company)</MenuItem>
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="브랜드" value={draft.brand ?? ''} onChange={(e) => patch({ brand: e.target.value })} fullWidth />
              <TextField size="small" label="태그 (쉼표 구분)" value={(draft.tags ?? []).join(', ')} onChange={(e) => patch({ tags: e.target.value.split(',') })} fullWidth />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField size="small" type="number" label="가로(mm) *" value={draft.widthMm} onChange={(e) => patch({ widthMm: Math.max(1, Number(e.target.value) || 0) })} />
              <TextField size="small" type="number" label="세로(mm) *" value={draft.depthMm} onChange={(e) => patch({ depthMm: Math.max(1, Number(e.target.value) || 0) })} />
              <TextField size="small" type="number" label="높이(mm)" value={draft.heightMm ?? ''} onChange={(e) => patch({ heightMm: Number(e.target.value) || undefined })} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField size="small" select label="3D 모델" value={draft.modelType ?? 'box'} onChange={(e) => patch({ modelType: e.target.value as Asset['modelType'] })} fullWidth>
                <MenuItem value="box">박스</MenuItem>
                <MenuItem value="cylinder">원통</MenuItem>
                <MenuItem value="flat">평판</MenuItem>
                <MenuItem value="custom">커스텀</MenuItem>
              </TextField>
              <TextField size="small" select label="재질" value={draft.material ?? 'matte'} onChange={(e) => patch({ material: e.target.value as Asset['material'] })} fullWidth>
                <MenuItem value="matte">무광</MenuItem>
                <MenuItem value="semiGloss">반광</MenuItem>
                <MenuItem value="gloss">유광</MenuItem>
                <MenuItem value="transparent">투명</MenuItem>
                <MenuItem value="acrylic">아크릴</MenuItem>
              </TextField>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={() => void save()} disabled={!draft.name.trim()}>{editing ? '저장' : '등록'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

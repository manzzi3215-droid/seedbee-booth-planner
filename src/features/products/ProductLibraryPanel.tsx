import { useRef, useState } from 'react';
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
import Menu from '@mui/material/Menu';
import Popover from '@mui/material/Popover';
import CircularProgress from '@mui/material/CircularProgress';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddLocationAltRoundedIcon from '@mui/icons-material/AddLocationAltRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import type { Product, ProductFacing, ProductMaterial, ProductBackgroundMode, ProductRenderMode } from '../../types';
import { useEditor } from '../editor/EditorContext';
import { uploadDesignAsset, isSupportedDesignFile } from '../../firebase/storage';
import { PRODUCT_FACINGS, DEFAULT_PRODUCT_COLOR } from './productModel';
import { PRODUCT_RENDER_MODES, PRODUCT_MATERIALS, THICKNESS_PRESETS } from './productGeometry';
import { renderProductPreview } from './productPreview';
import { preloadImages } from '../export/download';
import { generateId } from '../../utils/id';

const emptyDraft = (): Product => ({
  id: generateId(),
  name: '',
  widthMm: 80,
  depthMm: 80,
  heightMm: 200,
  displayColor: DEFAULT_PRODUCT_COLOR,
  displayDirection: 'front',
  recommendedSpacingMm: 10,
  backgroundMode: 'transparent',
  renderMode: 'standingCard',
  material: 'matte',
  createdAt: Date.now(),
});

/**
 * Product Library (Digital Merchandising, v0.9.3).
 * 제품 컴포넌트 등록/편집/삭제 + 캔버스 배치(배치 · 그리드). 제품은 프로젝트(행사) 단위로 Cloud Save.
 */
export default function ProductLibraryPanel() {
  const { products, addProduct, updateProduct, deleteProduct, placeProduct, gridArrangeProduct, canEdit } = useEditor();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Product>(emptyDraft());
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [arrangeAnchor, setArrangeAnchor] = useState<{ el: HTMLElement; product: Product } | null>(null);
  // Hover 3D 미리보기 (v0.9.9)
  const [hoverPreview, setHoverPreview] = useState<{ el: HTMLElement; url: string | null } | null>(null);
  const hoverIdRef = useRef<string | null>(null);

  const handleHoverEnter = async (e: React.MouseEvent<HTMLElement>, p: Product) => {
    const el = e.currentTarget;
    hoverIdRef.current = p.id;
    setHoverPreview({ el, url: null });
    try {
      const srcs = [p.thumbnailUrl, ...Object.values(p.images ?? {})].filter((s): s is string => !!s);
      const els = await preloadImages(srcs);
      if (hoverIdRef.current !== p.id) return; // 이미 다른 카드로 이동
      setHoverPreview({ el, url: renderProductPreview(p, els) });
    } catch {
      if (hoverIdRef.current === p.id) setHoverPreview({ el, url: null });
    }
  };
  const handleHoverLeave = () => {
    hoverIdRef.current = null;
    setHoverPreview(null);
  };

  const openAdd = () => {
    setDraft(emptyDraft());
    setEditing(false);
    setDialogOpen(true);
  };
  const openEdit = (p: Product) => {
    setDraft({ ...p });
    setEditing(true);
    setDialogOpen(true);
  };
  const patch = (p: Partial<Product>) => setDraft((d) => ({ ...d, ...p }));

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !isSupportedDesignFile(file)) return;
    setUploading(true);
    try {
      const a = await uploadDesignAsset(file); // 경량 dataURL 반환(재사용)
      patch({ thumbnailUrl: a.url });
    } catch {
      /* 무시 */
    } finally {
      setUploading(false);
    }
  };

  const save = () => {
    if (!draft.name.trim()) return;
    const clean: Product = { ...draft, name: draft.name.trim() };
    if (editing) updateProduct(clean.id, clean);
    else addProduct(clean);
    setDialogOpen(false);
  };

  const handleDelete = (p: Product) => {
    if (!window.confirm(`"${p.name}" 제품을 삭제할까요? 배치된 인스턴스도 함께 제거됩니다.`)) return;
    deleteProduct(p.id);
  };

  const handleArrange = (p: Product, pattern: 'grid' | 'row' | 'circle') => {
    const label = pattern === 'row' ? '한 줄(Row)' : pattern === 'circle' ? '원형(Circle)' : '그리드(Grid)';
    const n = Number(window.prompt(`${label}로 배치할 개수를 입력하세요.`, '8'));
    if (!Number.isFinite(n) || n < 1) return;
    gridArrangeProduct(p.id, Math.round(n), { spacingXMm: p.recommendedSpacingMm, pattern });
    setArrangeAnchor(null);
  };

  return (
    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          제품 (Merchandising)
        </Typography>
        <Chip label={`${products.length}개`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
      </Stack>

      <Button variant="contained" size="small" fullWidth startIcon={<AddRoundedIcon />} onClick={openAdd} sx={{ mb: 1 }} disabled={!canEdit}>
        제품 추가
      </Button>

      <Stack spacing={1} sx={{ overflowY: 'auto', pr: 0.5 }}>
        {products.map((p) => (
          <Paper key={p.id} elevation={0} onMouseEnter={(e) => void handleHoverEnter(e, p)} onMouseLeave={handleHoverLeave} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 0.75, overflow: 'hidden', bgcolor: p.displayColor || DEFAULT_PRODUCT_COLOR, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.thumbnailUrl && <img src={p.thumbnailUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700 }} title={p.name}>
                  {p.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {[p.brand, p.category].filter(Boolean).join(' · ') || '—'} · {p.widthMm}×{p.depthMm}mm
                </Typography>
              </Box>
              <Tooltip title="수정"><IconButton size="small" onClick={() => openEdit(p)}><EditRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
              <Tooltip title="삭제"><IconButton size="small" color="error" onClick={() => handleDelete(p)}><DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
              <Button size="small" variant="contained" startIcon={<AddLocationAltRoundedIcon sx={{ fontSize: 15 }} />} onClick={() => placeProduct(p.id)} disabled={!canEdit} sx={{ py: 0.2, flex: 1 }}>
                배치
              </Button>
              <Button size="small" variant="outlined" startIcon={<GridViewRoundedIcon sx={{ fontSize: 15 }} />} onClick={(e) => setArrangeAnchor({ el: e.currentTarget, product: p })} disabled={!canEdit} sx={{ py: 0.2 }}>
                진열
              </Button>
            </Stack>
          </Paper>
        ))}
        {products.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            등록된 제품이 없습니다. 제품을 추가해 진열을 시작하세요.
          </Typography>
        )}
      </Stack>

      {/* 진열 패턴 메뉴 (Single/Grid/Row/Circle, v0.9.9) */}
      <Menu anchorEl={arrangeAnchor?.el ?? null} open={!!arrangeAnchor} onClose={() => setArrangeAnchor(null)}>
        <MenuItem onClick={() => { if (arrangeAnchor) placeProduct(arrangeAnchor.product.id); setArrangeAnchor(null); }}>Single (1개)</MenuItem>
        <MenuItem onClick={() => arrangeAnchor && handleArrange(arrangeAnchor.product, 'grid')}>Grid (그리드)</MenuItem>
        <MenuItem onClick={() => arrangeAnchor && handleArrange(arrangeAnchor.product, 'row')}>Row (한 줄)</MenuItem>
        <MenuItem onClick={() => arrangeAnchor && handleArrange(arrangeAnchor.product, 'circle')}>Circle (원형)</MenuItem>
      </Menu>

      {/* Hover 3D 미리보기 (v0.9.9) */}
      <Popover
        open={!!hoverPreview}
        anchorEl={hoverPreview?.el ?? null}
        onClose={handleHoverLeave}
        anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
        transformOrigin={{ vertical: 'center', horizontal: 'left' }}
        disableRestoreFocus
        sx={{ pointerEvents: 'none' }}
      >
        <Box sx={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#eef1f5' }}>
          {hoverPreview?.url ? (
            <img src={hoverPreview.url} alt="3D 미리보기" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <CircularProgress size={22} />
          )}
        </Box>
      </Popover>

      {/* 제품 등록/수정 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? '제품 수정' : '제품 추가'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box sx={{ width: 72, height: 72, flexShrink: 0, borderRadius: 1, overflow: 'hidden', bgcolor: draft.displayColor || DEFAULT_PRODUCT_COLOR, border: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {draft.thumbnailUrl && <img src={draft.thumbnailUrl} alt="thumb" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
              </Box>
              <Stack spacing={0.5}>
                <Button size="small" startIcon={<CloudUploadRoundedIcon />} onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '업로드 중…' : '이미지 업로드 (PNG/SVG/WEBP)'}
                </Button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" style={{ display: 'none' }} onChange={handleImage} />
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">진열색</Typography>
                  <input type="color" value={draft.displayColor || DEFAULT_PRODUCT_COLOR} onChange={(e) => patch({ displayColor: e.target.value })} style={{ width: 32, height: 26, border: 'none', background: 'none', cursor: 'pointer' }} />
                </Stack>
              </Stack>
            </Stack>

            <TextField size="small" label="제품명 *" value={draft.name} onChange={(e) => patch({ name: e.target.value })} autoFocus />
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="브랜드" value={draft.brand ?? ''} onChange={(e) => patch({ brand: e.target.value })} fullWidth />
              <TextField size="small" label="카테고리" value={draft.category ?? ''} onChange={(e) => patch({ category: e.target.value })} fullWidth />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="SKU" value={draft.sku ?? ''} onChange={(e) => patch({ sku: e.target.value })} fullWidth />
              <TextField size="small" label="진열그룹" value={draft.displayGroup ?? ''} onChange={(e) => patch({ displayGroup: e.target.value })} fullWidth />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField size="small" type="number" label="가로(mm)" value={draft.widthMm} onChange={(e) => patch({ widthMm: Math.max(1, Number(e.target.value) || 0) })} />
              <TextField size="small" type="number" label="세로(mm)" value={draft.depthMm} onChange={(e) => patch({ depthMm: Math.max(1, Number(e.target.value) || 0) })} />
              <TextField size="small" type="number" label="높이(mm)" value={draft.heightMm ?? ''} onChange={(e) => patch({ heightMm: Number(e.target.value) || undefined })} />
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField size="small" type="number" label="무게(g)" value={draft.weightG ?? ''} onChange={(e) => patch({ weightG: Number(e.target.value) || undefined })} fullWidth />
              <TextField size="small" select label="진열 방향" value={draft.displayDirection ?? 'front'} onChange={(e) => patch({ displayDirection: e.target.value as ProductFacing })} fullWidth>
                {PRODUCT_FACINGS.map((f) => <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>)}
              </TextField>
              <TextField size="small" type="number" label="간격(mm)" value={draft.recommendedSpacingMm ?? ''} onChange={(e) => patch({ recommendedSpacingMm: Number(e.target.value) || undefined })} fullWidth />
            </Stack>
            {/* 3D 표현 (v0.9.9): 배경/지오메트리/두께/재질 */}
            <Stack direction="row" spacing={1}>
              <TextField size="small" select label="배경" value={draft.backgroundMode ?? 'solid'} onChange={(e) => patch({ backgroundMode: e.target.value as ProductBackgroundMode })} fullWidth>
                <MenuItem value="solid">Solid Color</MenuItem>
                <MenuItem value="transparent">Transparent (누끼)</MenuItem>
              </TextField>
              <TextField size="small" select label="렌더 모드" value={draft.renderMode ?? 'standingCard'} onChange={(e) => patch({ renderMode: e.target.value as ProductRenderMode })} fullWidth>
                {PRODUCT_RENDER_MODES.map((g) => <MenuItem key={g.value} value={g.value}>{g.label}</MenuItem>)}
              </TextField>
            </Stack>
            <Stack direction="row" spacing={1}>
              <TextField size="small" select label="재질" value={draft.material ?? 'matte'} onChange={(e) => patch({ material: e.target.value as ProductMaterial })} fullWidth>
                {PRODUCT_MATERIALS.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </TextField>
              <TextField
                size="small"
                type="number"
                label="두께(mm)"
                value={draft.thicknessMm ?? ''}
                onChange={(e) => patch({ thicknessMm: Number(e.target.value) || undefined })}
                placeholder="자동"
                fullWidth
                helperText={`예: ${THICKNESS_PRESETS.join(' / ')}`}
              />
            </Stack>
            <TextField size="small" label="메모" value={draft.memo ?? ''} onChange={(e) => patch({ memo: e.target.value })} multiline minRows={1} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDialogOpen(false)}>취소</Button>
          <Button variant="contained" onClick={save} disabled={!draft.name.trim()}>{editing ? '저장' : '추가'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

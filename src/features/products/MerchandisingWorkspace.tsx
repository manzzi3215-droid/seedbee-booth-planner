import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Checkbox from '@mui/material/Checkbox';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import { useEditor } from '../editor/EditorContext';
import { computeDisplayStats } from './productModel';
import {
  buildDisplayGuideDataURL,
  downloadDisplayGuidePNG,
  downloadDisplayGuidePDF,
  type DisplayGuideInput,
} from './displayGuide';

/**
 * Merchandising Workspace (v0.9.3) — 진열 통계 · Display Guide(PNG/PDF) · 설치 모드 체크리스트.
 */
export default function MerchandisingWorkspace({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    project,
    placed,
    texts,
    dimensions,
    planImages,
    planBackgrounds,
    designAssets,
    fixturesById,
    placedProducts,
    products,
    layouts,
    currentLayoutId,
  } = useEditor();

  const [tab, setTab] = useState<'guide' | 'install'>('guide');
  const [guideUrl, setGuideUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const layoutName = layouts.find((l) => l.id === currentLayoutId)?.name ?? '미저장';
  const stats = useMemo(
    () => computeDisplayStats(placedProducts, (id) => products.find((p) => p.id === id)),
    [placedProducts, products],
  );

  const guideInput = (): DisplayGuideInput | null => {
    if (!project) return null;
    return {
      projectName: project.name,
      layoutName,
      booth: project.boothConfig,
      placed,
      texts,
      dimensions,
      images: planImages,
      backgrounds: planBackgrounds,
      fixturesById,
      designAssets,
      placedProducts,
      products,
    };
  };

  // 진열 가이드 미리보기 생성
  useEffect(() => {
    if (!open) {
      setGuideUrl(null);
      setChecked(new Set());
      return;
    }
    let active = true;
    const input = guideInput();
    if (!input) return;
    setLoading(true);
    buildDisplayGuideDataURL(input)
      .then((url) => {
        if (active) setGuideUrl(url);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, placedProducts, products, placed]);

  const exportPNG = async () => {
    const input = guideInput();
    if (!input) return;
    setBusy(true);
    try {
      await downloadDisplayGuidePNG(input);
    } finally {
      setBusy(false);
    }
  };
  const exportPDF = async () => {
    const input = guideInput();
    if (!input) return;
    setBusy(true);
    try {
      await downloadDisplayGuidePDF(input);
    } finally {
      setBusy(false);
    }
  };

  // 설치 모드 체크리스트: 제품별 집계
  const installRows = useMemo(() => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const agg = new Map<string, { name: string; brand: string; count: number }>();
    for (const pp of placedProducts) {
      const prod = byId.get(pp.productId);
      if (!prod) continue;
      const ex = agg.get(pp.productId);
      if (ex) ex.count += 1;
      else agg.set(pp.productId, { name: prod.name, brand: prod.brand || '—', count: 1 });
    }
    return [...agg.entries()].map(([id, v]) => ({ id, ...v }));
  }, [placedProducts, products]);

  const toggleCheck = (id: string) =>
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>진열 관리 (Merchandising)</DialogTitle>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, minHeight: 42 }}>
        <Tab value="guide" label="진열 가이드" sx={{ minHeight: 42 }} />
        <Tab value="install" label="설치 모드" sx={{ minHeight: 42 }} />
      </Tabs>
      <DialogContent dividers>
        {/* 통계 */}
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Chip color="primary" label={`총 진열 ${stats.total}개`} />
          <Chip variant="outlined" label={`제품 종류 ${stats.uniqueProducts}`} />
          <Chip variant="outlined" label={`카테고리 ${stats.categories.length}`} />
          <Chip variant="outlined" label={`브랜드 ${stats.brands.length}`} />
          {stats.categories.slice(0, 4).map((c) => (
            <Chip key={c.name} size="small" variant="outlined" label={`${c.name} ${c.count}`} />
          ))}
        </Stack>

        {tab === 'guide' ? (
          <>
            <Box sx={{ height: '54vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#eef1f5', borderRadius: 1, overflow: 'auto' }}>
              {loading ? (
                <CircularProgress />
              ) : guideUrl ? (
                <img src={guideUrl} alt="진열 가이드" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <Typography variant="body2" color="text.secondary">가이드를 생성할 수 없습니다.</Typography>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              현장 작업자가 이 가이드만 보고 동일하게 진열할 수 있도록 진열도 + 제품 목록(수량·Facing)을 담았습니다.
            </Typography>
          </>
        ) : (
          <Box sx={{ height: '54vh', overflowY: 'auto' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              제품별 설치 체크리스트 — 완료 시 체크하세요. ({checked.size}/{installRows.length} 완료)
            </Typography>
            <Stack spacing={0.75}>
              {installRows.map((r) => (
                <Paper key={r.id} variant="outlined" sx={{ p: 1, display: 'flex', alignItems: 'center', gap: 1, opacity: checked.has(r.id) ? 0.55 : 1 }}>
                  <Checkbox checked={checked.has(r.id)} onChange={() => toggleCheck(r.id)} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, textDecoration: checked.has(r.id) ? 'line-through' : 'none' }} noWrap>
                      {r.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{r.brand}</Typography>
                  </Box>
                  <Chip size="small" label={`${r.count}개`} />
                </Paper>
              ))}
              {installRows.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  진열된 제품이 없습니다.
                </Typography>
              )}
            </Stack>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">닫기</Button>
        <Button variant="outlined" startIcon={<ImageRoundedIcon />} onClick={exportPNG} disabled={busy || !project}>
          가이드 PNG
        </Button>
        <Button variant="contained" startIcon={<PictureAsPdfRoundedIcon />} onClick={exportPDF} disabled={busy || !project}>
          가이드 PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
}

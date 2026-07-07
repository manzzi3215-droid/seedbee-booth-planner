import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import type { Product, VmdBoard } from '../../types';
import { renderIsoSceneToDataURL, DEFAULT_ISO_OPTIONS } from '../iso/renderIso';
import { defaultLighting } from '../iso/lighting/LightingEngine';
import { preloadImages, downloadDataURL } from '../export/download';
import { vmdBoardToIsoScene, collectVmdImageSrcs } from './vmdIsoScene';
import { countProducts } from './vmdModel';

const PREVIEW_PX = 1400;

/** VMD 3D 미리보기 시점 (§1) */
const VIEWS: { id: string; label: string; az: number; el: number }[] = [
  { id: 'front', label: '정면', az: 0, el: 24 },
  { id: 'left', label: '좌측 사선', az: -42, el: 30 },
  { id: 'right', label: '우측 사선', az: 42, el: 30 },
  { id: 'top', label: 'Top', az: 0, el: 90 },
];

/**
 * VMD Board 3D Mockup 미리보기 (v1.0.3).
 * 기존 Booth 3D 렌더러(renderIso)를 재사용해 제품이 상판 위에 놓인 실무 시안을 생성.
 * 정면/좌·우 사선/Top · 흰색/회색 배경 · 그림자 · PNG/투명 PNG/PDF 저장.
 */
export default function VmdPreviewDialog({
  open,
  board,
  products,
  onClose,
}: {
  open: boolean;
  board: VmdBoard | null;
  products: Product[];
  onClose: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState('left');
  const [bg, setBg] = useState<'white' | 'gray'>('white');
  const [shadows, setShadows] = useState(true);
  const imageEls = useRef<Map<string, HTMLImageElement>>(new Map());
  const lighting = useRef(defaultLighting());

  // 이미지 preload
  useEffect(() => {
    if (!open || !board) {
      setReady(false);
      setDataUrl(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const els = await preloadImages(collectVmdImageSrcs(board, products));
      if (!active) return;
      imageEls.current = els;
      setReady(true);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, board, products]);

  const renderOpts = (transparent: boolean, targetPx: number) => {
    const v = VIEWS.find((x) => x.id === view) ?? VIEWS[1];
    const light = { ...lighting.current, shadow: { ...lighting.current.shadow, enabled: shadows }, groundReflection: 0.15 };
    return {
      ...DEFAULT_ISO_OPTIONS,
      floorColor: bg === 'white' ? '#f4f6f8' : '#e6e9ee',
      floorChecker: false,
      showNames: false,
      showShadows: shadows,
      envBgTop: transparent ? undefined : bg === 'white' ? '#ffffff' : '#e8ebef',
      envBgBottom: transparent ? undefined : bg === 'white' ? '#f3f5f8' : '#d3d8df',
      transparentBg: transparent,
      azimuthDeg: v.az,
      elevationDeg: v.el,
      lighting: light,
      targetPx,
    };
  };

  // 렌더
  useEffect(() => {
    if (!open || !board || !ready) return;
    const scene = vmdBoardToIsoScene(board, products);
    try {
      setDataUrl(renderIsoSceneToDataURL(scene, imageEls.current, renderOpts(false, PREVIEW_PX)));
    } catch {
      setDataUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, board, products, view, bg, shadows]);

  const baseName = board ? `${board.name}_3D`.replace(/[\\/:*?"<>|]/g, '_') : 'vmd_3d';
  const exportPng = (transparent: boolean) => {
    if (!board) return;
    const scene = vmdBoardToIsoScene(board, products);
    const url = renderIsoSceneToDataURL(scene, imageEls.current, renderOpts(transparent, 2600));
    downloadDataURL(url, `${baseName}${transparent ? '_투명' : ''}.png`);
  };
  const exportPdf = async () => {
    if (!board) return;
    const scene = vmdBoardToIsoScene(board, products);
    const url = renderIsoSceneToDataURL(scene, imageEls.current, renderOpts(false, 2600));
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    pdf.setFontSize(14);
    pdf.text(`VMD 3D 시안 · ${board.name}`, 12, 14);
    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(`보드 사이즈: ${board.widthMm} × ${board.heightMm} mm`, 12, 20);
    const iw = pageW - 24;
    const ih = iw * 0.52;
    pdf.addImage(url, 'PNG', 12, 26, iw, ih);
    let y = 26 + ih + 8;
    pdf.setTextColor(20);
    pdf.setFontSize(11);
    pdf.text('제품 리스트', 12, y);
    y += 6;
    pdf.setFontSize(9);
    const rows = countProducts(board.elements, (id) => products.find((p) => p.id === id)?.name ?? '제품');
    for (const r of rows) { pdf.setTextColor(30); pdf.text(`· ${r.name}  ${r.count}개`, 12, y); y += 5.5; }
    pdf.save(`${baseName}.pdf`);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>VMD 3D 미리보기 {board ? `· ${board.name}` : ''}</DialogTitle>
      <DialogContent dividers>
        <Stack direction="row" spacing={1.5} sx={{ mb: 1.5, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <ToggleButtonGroup exclusive size="small" value={view} onChange={(_, v) => v && setView(v)}>
            {VIEWS.map((x) => <ToggleButton key={x.id} value={x.id} sx={{ px: 1.5 }}>{x.label}</ToggleButton>)}
          </ToggleButtonGroup>
          <ToggleButtonGroup exclusive size="small" value={bg} onChange={(_, v) => v && setBg(v)}>
            <ToggleButton value="white" sx={{ px: 1.5 }}>흰 배경</ToggleButton>
            <ToggleButton value="gray" sx={{ px: 1.5 }}>연회색</ToggleButton>
          </ToggleButtonGroup>
          <FormControlLabel control={<Switch size="small" checked={shadows} onChange={(e) => setShadows(e.target.checked)} />} label={<Typography variant="caption">그림자</Typography>} sx={{ ml: 0 }} />
        </Stack>

        <Box sx={{ height: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: bg === 'white' ? '#fafbfc' : '#eef1f5', borderRadius: 1, overflow: 'hidden' }}>
          {loading && <CircularProgress />}
          {!loading && dataUrl && <img src={dataUrl} alt="VMD 3D 미리보기" style={{ maxWidth: '100%', maxHeight: '100%' }} />}
          {!loading && !dataUrl && <Typography variant="body2" color="text.secondary">미리보기를 생성할 수 없습니다.</Typography>}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          제품이 상판 위에 놓인 실무 DP 시안 미리보기입니다. 편집은 2D VMD 화면에서 하세요.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">닫기</Button>
        <Button startIcon={<ImageRoundedIcon />} onClick={() => exportPng(false)} disabled={!ready}>PNG</Button>
        <Button onClick={() => exportPng(true)} disabled={!ready}>투명 PNG</Button>
        <Button variant="contained" startIcon={<PictureAsPdfRoundedIcon />} onClick={exportPdf} disabled={!ready}>PDF</Button>
      </DialogActions>
    </Dialog>
  );
}

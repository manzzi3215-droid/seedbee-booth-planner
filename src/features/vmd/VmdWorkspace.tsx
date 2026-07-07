import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Menu from '@mui/material/Menu';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import RedoRoundedIcon from '@mui/icons-material/RedoRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import type { VmdElement } from '../../types';
import { useVmd } from './useVmd';
import VmdCanvas from './VmdCanvas';
import VmdPreviewDialog from './VmdPreviewDialog';
import { countProducts, createBoard, makeElement } from './vmdModel';
import { uploadDesignAsset, isSupportedDesignFile } from '../../firebase/storage';
import { productImageUrl } from '../products/productModel';
import { downloadDataURL } from '../export/download';

type AlignMode = 'left' | 'right' | 'hcenter' | 'top' | 'bottom' | 'vcenter';

export default function VmdWorkspace() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const vmd = useVmd(projectId);
  const {
    loading, project, products, boards, presets, currentBoard, currentBoardId, setCurrentBoardId,
    selectedIds, setSelectedIds, saveState, addBoard, deleteBoard, patchCurrentBoard,
    addElement, updateElement, removeElements, duplicateElements, reorderElement, setElements,
    undo, redo, canUndo, canRedo, savePreset, loadPreset, deletePreset, togglePresetFavorite,
    templates, saveTemplate, renameTemplate, deleteTemplate, duplicateTemplate, toggleTemplateFavorite, applyTemplate,
  } = vmd;

  const exportRef = useRef<((opts: { transparent: boolean; pixelRatio?: number }) => string | null) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const uploadKind = useRef<'image' | 'qr' | 'pop' | 'logo'>('image');
  const [customW, setCustomW] = useState('900');
  const [customH, setCustomH] = useState('450');
  const [presetQuery, setPresetQuery] = useState('');
  const [preview3dOpen, setPreview3dOpen] = useState(false);
  const [elMenuAnchor, setElMenuAnchor] = useState<null | HTMLElement>(null);

  // §12: Booth 집기에서 넘어온 경우(?w&h&name) 자동으로 보드 생성 (1회)
  const consumedQuery = useRef(false);
  useEffect(() => {
    if (loading || consumedQuery.current) return;
    const w = Number(searchParams.get('w'));
    const h = Number(searchParams.get('h'));
    if (w > 0 && h > 0) {
      consumedQuery.current = true;
      const name = searchParams.get('name') || undefined;
      addBoard(createBoard({ widthMm: Math.round(w), heightMm: Math.round(h), name: name ? `${name} 진열` : undefined, sourceFixtureName: name ?? undefined }));
      searchParams.delete('w'); searchParams.delete('h'); searchParams.delete('name');
      setSearchParams(searchParams, { replace: true });
    }
  }, [loading, searchParams, addBoard, setSearchParams]);

  const registerExport = useCallback((fn: typeof exportRef.current) => { exportRef.current = fn; }, []);
  const onSelect = useCallback((id: string | null, additive: boolean) => {
    if (id == null) { setSelectedIds([]); return; }
    setSelectedIds((prev) => (additive ? (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]) : [id]));
  }, [setSelectedIds]);
  const onCommit = useCallback(() => { /* drag/transform 은 이미 commit 됨 */ }, []);

  // ---- 키보드 단축키 (Booth 편집기 수준, §7/§10) — 모든 훅은 early return 이전에 호출 ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!currentBoard) return;
      const meta = e.ctrlKey || e.metaKey;
      const ids = new Set(selectedIds);
      if (meta && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if (meta && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); redo(); return; }
      if (meta && (e.key === 'd' || e.key === 'D')) { e.preventDefault(); if (selectedIds.length) duplicateElements(selectedIds); return; }
      if (meta && e.key === ']') { e.preventDefault(); selectedIds.forEach((id) => reorderElement(id, e.shiftKey ? 'top' : 'up')); return; }
      if (meta && e.key === '[') { e.preventDefault(); selectedIds.forEach((id) => reorderElement(id, e.shiftKey ? 'bottom' : 'down')); return; }
      if (meta) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedIds.length) { e.preventDefault(); removeElements(selectedIds); } return; }
      if (e.key === 'r' || e.key === 'R') { if (selectedIds.length) { e.preventDefault(); setElements((els) => els.map((el) => (ids.has(el.id) && !el.locked ? { ...el, rotationDeg: (el.rotationDeg + 90) % 360 } : el))); } return; }
      if (e.key === 'Escape') { setSelectedIds([]); return; }
      if (!selectedIds.length) return;
      const step = e.shiftKey ? 500 : 100;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else return;
      e.preventDefault();
      setElements((els) => els.map((el) => (ids.has(el.id) && !el.locked ? { ...el, xMm: el.xMm + dx, yMm: el.yMm + dy } : el)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, currentBoard, setElements, removeElements, duplicateElements, reorderElement, undo, redo, setSelectedIds]);

  if (loading) {
    return <Box sx={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>;
  }
  if (!project) {
    return <Box sx={{ p: 4 }}><Typography>프로젝트를 찾을 수 없습니다.</Typography></Box>;
  }

  const board = currentBoard;

  // ---- 요소 추가 ----
  const addProductEl = (productId: string) => {
    if (!board) return;
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    const w = Math.min(board.widthMm * 0.32, 300);
    const h = Math.max(20, w * ((p.heightMm ?? p.depthMm) / p.widthMm));
    addElement(makeElement('product', board, { name: p.name, productId, widthMm: Math.round(w), heightMm: Math.round(h) }));
  };
  const addText = () => board && addElement(makeElement('text', board, { name: '텍스트', text: '텍스트', widthMm: 400, heightMm: 120, fontSizeMm: 70, color: '#0f172a', align: 'center' }));
  const addPrice = () => board && addElement(makeElement('text', board, { name: '가격표', text: '₩0,000', widthMm: 320, heightMm: 130, fontSizeMm: 80, bold: true, color: '#dc2626', bgColor: '#fff7ed', align: 'center' }));
  const addCard = () => board && addElement(makeElement('text', board, { name: '설명 카드', text: '제품 설명', widthMm: 500, heightMm: 300, fontSizeMm: 44, color: '#334155', bgColor: '#ffffff', align: 'center' }));
  const addShape = (shape: 'rect' | 'circle') => board && addElement(makeElement('shape', board, { name: shape === 'circle' ? '원형 스티커' : '사각 스티커', shape, widthMm: 260, heightMm: 260, fill: '#fde047', stroke: '#f59e0b', strokeWidthMm: 4 }));
  const addLine = (arrow: boolean) => board && addElement(makeElement('line', board, { name: arrow ? '화살표' : '라인', widthMm: 300, heightMm: 4, x2Mm: undefined, y2Mm: undefined, xMm: Math.round(board.widthMm / 2 - 150), yMm: Math.round(board.heightMm / 2), stroke: '#0f172a', strokeWidthMm: 6, arrow }));

  const onPickFile = (kind: 'image' | 'qr' | 'pop' | 'logo') => { uploadKind.current = kind; fileRef.current?.click(); };
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !isSupportedDesignFile(file) || !board) return;
    const a = await uploadDesignAsset(file);
    const kind = uploadKind.current;
    const name = kind === 'qr' ? 'QR' : kind === 'pop' ? 'POP' : kind === 'logo' ? '로고' : '이미지';
    const w = kind === 'qr' ? 200 : 400;
    addElement(makeElement('image', board, { name, src: a.url, widthMm: w, heightMm: w * ((a.heightPx ?? 1) / (a.widthPx ?? 1)) || w }));
  };
  const handleBgFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file || !isSupportedDesignFile(file) || !board) return;
    const a = await uploadDesignAsset(file);
    patchCurrentBoard({ background: { ...board.background, mode: 'image', imageSrc: a.url } });
  };

  // ---- 정렬 (§7) ----
  const align = (mode: AlignMode) => {
    if (!board || selectedIds.length === 0) return;
    const sel = board.elements.filter((e) => selectedIds.includes(e.id));
    const single = sel.length === 1;
    const bMinX = single ? 0 : Math.min(...sel.map((e) => e.xMm));
    const bMaxX = single ? board.widthMm : Math.max(...sel.map((e) => e.xMm + e.widthMm));
    const bMinY = single ? 0 : Math.min(...sel.map((e) => e.yMm));
    const bMaxY = single ? board.heightMm : Math.max(...sel.map((e) => e.yMm + e.heightMm));
    const ids = new Set(selectedIds);
    setElements((els) => els.map((e) => {
      if (!ids.has(e.id)) return e;
      if (mode === 'left') return { ...e, xMm: bMinX };
      if (mode === 'right') return { ...e, xMm: bMaxX - e.widthMm };
      if (mode === 'hcenter') return { ...e, xMm: Math.round((bMinX + bMaxX) / 2 - e.widthMm / 2) };
      if (mode === 'top') return { ...e, yMm: bMinY };
      if (mode === 'bottom') return { ...e, yMm: bMaxY - e.heightMm };
      return { ...e, yMm: Math.round((bMinY + bMaxY) / 2 - e.heightMm / 2) };
    }));
  };
  const distribute = (axis: 'h' | 'v') => {
    if (!board || selectedIds.length < 3) return;
    const ids = new Set(selectedIds);
    const sel = [...board.elements.filter((e) => ids.has(e.id))].sort((a, b) => (axis === 'h' ? a.xMm - b.xMm : a.yMm - b.yMm));
    const minP = axis === 'h' ? sel[0].xMm : sel[0].yMm;
    const last = sel[sel.length - 1];
    const maxP = axis === 'h' ? last.xMm + last.widthMm : last.yMm + last.heightMm;
    const totalSize = sel.reduce((s, e) => s + (axis === 'h' ? e.widthMm : e.heightMm), 0);
    const gap = (maxP - minP - totalSize) / (sel.length - 1);
    let cur = minP;
    const posMap = new Map<string, number>();
    for (const e of sel) { posMap.set(e.id, cur); cur += (axis === 'h' ? e.widthMm : e.heightMm) + gap; }
    setElements((els) => els.map((e) => (posMap.has(e.id) ? { ...e, [axis === 'h' ? 'xMm' : 'yMm']: Math.round(posMap.get(e.id)!) } : e)));
  };

  // ---- 선택 요소 일괄 조작 (§14) ----
  const centerOnBoard = () => {
    if (!board || selectedIds.length === 0) return;
    const ids = new Set(selectedIds);
    setElements((els) => els.map((e) => (ids.has(e.id) ? { ...e, xMm: Math.round(board.widthMm / 2 - e.widthMm / 2), yMm: Math.round(board.heightMm / 2 - e.heightMm / 2) } : e)));
  };
  const fitToBoard = () => {
    if (!board || selectedIds.length !== 1) return;
    const el = board.elements.find((e) => e.id === selectedIds[0]);
    if (!el) return;
    const m = Math.min(board.widthMm, board.heightMm) * 0.06;
    const scale = Math.min((board.widthMm - m * 2) / el.widthMm, (board.heightMm - m * 2) / el.heightMm);
    const w = Math.round(el.widthMm * scale);
    const h = Math.round(el.heightMm * scale);
    updateElement(el.id, { widthMm: w, heightMm: h, xMm: Math.round(board.widthMm / 2 - w / 2), yMm: Math.round(board.heightMm / 2 - h / 2) });
  };

  // ---- Export ----
  const baseName = `${project.name}_${board?.name ?? 'VMD'}`.replace(/[\\/:*?"<>|]/g, '_');
  const exportPng = (transparent: boolean) => {
    const url = exportRef.current?.({ transparent, pixelRatio: 3 });
    if (url) downloadDataURL(url, `${baseName}${transparent ? '_투명' : ''}.png`);
  };
  const exportPdf = async () => {
    if (!board) return;
    const url = exportRef.current?.({ transparent: false, pixelRatio: 3 });
    if (!url) return;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: board.widthMm >= board.heightMm ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgRatio = board.widthMm / board.heightMm;
    let iw = pageW - 24; let ih = iw / imgRatio;
    if (ih > pageH * 0.6) { ih = pageH * 0.6; iw = ih * imgRatio; }
    pdf.setFontSize(14); pdf.text(`VMD 시안 · ${board.name}`, 12, 14);
    pdf.setFontSize(9); pdf.setTextColor(100);
    pdf.text(`보드 사이즈: ${board.widthMm} × ${board.heightMm} mm`, 12, 20);
    pdf.addImage(url, 'PNG', (pageW - iw) / 2, 26, iw, ih);
    let y = 26 + ih + 8;
    pdf.setTextColor(20); pdf.setFontSize(11); pdf.text('제품 리스트', 12, y); y += 6;
    pdf.setFontSize(9);
    const rows = countProducts(board.elements, (id) => products.find((p) => p.id === id)?.name ?? '제품');
    if (rows.length === 0) { pdf.setTextColor(150); pdf.text('배치된 제품이 없습니다.', 12, y); y += 6; }
    for (const r of rows) { pdf.setTextColor(30); pdf.text(`· ${r.name}  ${r.count}개`, 12, y); y += 5.5; }
    if (board.memo) { y += 3; pdf.setTextColor(80); pdf.text(`메모: ${board.memo}`, 12, y); }
    pdf.save(`${baseName}.pdf`);
  };

  const selEl = selectedIds.length === 1 ? board?.elements.find((e) => e.id === selectedIds[0]) ?? null : null;
  const patchSel = (patch: Partial<VmdElement>) => selEl && updateElement(selEl.id, patch);
  const counts = board ? countProducts(board.elements, (id) => products.find((p) => p.id === id)?.name ?? '제품') : [];

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* 상단 바 */}
      <Stack direction="row" spacing={1} sx={{ p: 1, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Button size="small" startIcon={<ArrowBackRoundedIcon />} onClick={() => navigate(`/projects/${projectId}/editor`)}>편집기</Button>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>VMD 시안</Typography>
        <Chip size="small" label={project.name} variant="outlined" />
        <Box sx={{ flex: 1 }} />
        <Tooltip title="실행 취소"><span><IconButton size="small" onClick={undo} disabled={!canUndo}><UndoRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="다시 실행"><span><IconButton size="small" onClick={redo} disabled={!canRedo}><RedoRoundedIcon fontSize="small" /></IconButton></span></Tooltip>
        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 56, textAlign: 'center' }}>
          {saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : ''}
        </Typography>
        <Button size="small" variant="contained" color="secondary" startIcon={<ViewInArRoundedIcon />} onClick={() => setPreview3dOpen(true)} disabled={!board}>3D 미리보기</Button>
        <Button size="small" variant="outlined" startIcon={<ImageRoundedIcon />} onClick={() => exportPng(false)} disabled={!board}>PNG</Button>
        <Button size="small" variant="outlined" onClick={() => exportPng(true)} disabled={!board}>투명 PNG</Button>
        <Button size="small" variant="outlined" startIcon={<PictureAsPdfRoundedIcon />} onClick={exportPdf} disabled={!board}>PDF</Button>
      </Stack>

      <VmdPreviewDialog open={preview3dOpen} board={board} products={products} onClose={() => setPreview3dOpen(false)} />

      {/* 요소 추가 메뉴 (§4) */}
      <Menu anchorEl={elMenuAnchor} open={!!elMenuAnchor} onClose={() => setElMenuAnchor(null)}>
        {[
          { label: '텍스트', fn: addText },
          { label: '가격표', fn: addPrice },
          { label: '설명 카드', fn: addCard },
          { label: 'POP 이미지', fn: () => onPickFile('pop') },
          { label: 'QR 이미지', fn: () => onPickFile('qr') },
          { label: '로고', fn: () => onPickFile('logo') },
          { label: '이미지', fn: () => onPickFile('image') },
          { label: '사각형', fn: () => addShape('rect') },
          { label: '원형', fn: () => addShape('circle') },
          { label: '라인', fn: () => addLine(false) },
          { label: '화살표', fn: () => addLine(true) },
        ].map((it) => (
          <MenuItem key={it.label} onClick={() => { it.fn(); setElMenuAnchor(null); }}>{it.label}</MenuItem>
        ))}
      </Menu>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* 좌측: 보드/요소/제품 */}
        <Box sx={{ width: 260, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto', p: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 800 }}>보드</Typography>
          <Select size="small" fullWidth value={currentBoardId ?? ''} onChange={(e) => { setCurrentBoardId(e.target.value); setSelectedIds([]); }} sx={{ my: 0.5 }} displayEmpty>
            {boards.length === 0 && <MenuItem value="" disabled>보드 없음</MenuItem>}
            {boards.map((b) => <MenuItem key={b.id} value={b.id}>{b.name} ({b.widthMm}×{b.heightMm})</MenuItem>)}
          </Select>
          <Stack direction="row" spacing={0.5} sx={{ mb: 1 }}>
            <Button size="small" variant="contained" fullWidth startIcon={<AddRoundedIcon />} onClick={() => addBoard(createBoard({ widthMm: Number(customW) || 900, heightMm: Number(customH) || 450 }))}>새 보드</Button>
            {board && <Button size="small" color="error" onClick={() => deleteBoard(board.id)}>삭제</Button>}
          </Stack>

          <Typography variant="caption" sx={{ fontWeight: 800 }}>사이즈 (mm, 자유 입력)</Typography>
          <Stack direction="row" spacing={0.5} sx={{ mb: 1, mt: 0.5, alignItems: 'center' }}>
            <TextField size="small" type="number" label="W" value={board?.widthMm ?? customW} onChange={(e) => { const v = Math.max(50, Number(e.target.value) || 0); setCustomW(String(v)); board && patchCurrentBoard({ widthMm: v }); }} sx={{ width: 90 }} />
            <Typography variant="caption">×</Typography>
            <TextField size="small" type="number" label="H" value={board?.heightMm ?? customH} onChange={(e) => { const v = Math.max(50, Number(e.target.value) || 0); setCustomH(String(v)); board && patchCurrentBoard({ heightMm: v }); }} sx={{ width: 90 }} />
          </Stack>

          {/* 사용자 템플릿 (§1) */}
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="caption" sx={{ fontWeight: 800 }}>내 템플릿</Typography>
            <Button size="small" disabled={!board} onClick={() => { const n = window.prompt('템플릿 이름', board ? `${board.widthMm}×${board.heightMm}` : ''); if (n) saveTemplate(n); }} sx={{ fontSize: 10, minWidth: 0, py: 0 }}>+ 저장</Button>
          </Stack>
          <Stack spacing={0.25} sx={{ my: 0.5, mb: 1 }}>
            {templates.length === 0 && <Typography variant="caption" color="text.secondary">현재 보드를 템플릿으로 저장하세요.</Typography>}
            {[...templates].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite)).map((t) => (
              <Paper key={t.id} variant="outlined" sx={{ px: 0.5, py: 0.25, display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <IconButton size="small" onClick={() => toggleTemplateFavorite(t.id)}>{t.favorite ? <StarRoundedIcon sx={{ fontSize: 15, color: '#f5b400' }} /> : <StarBorderRoundedIcon sx={{ fontSize: 15 }} />}</IconButton>
                <Typography variant="caption" noWrap sx={{ flex: 1, cursor: 'pointer' }} onClick={() => applyTemplate(t.id)} title={`${t.widthMm}×${t.heightMm}`}>{t.name}</Typography>
                <IconButton size="small" onClick={() => { const n = window.prompt('이름 변경', t.name); if (n) renameTemplate(t.id, n); }}><EditRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
                <IconButton size="small" onClick={() => duplicateTemplate(t.id)}><ContentCopyRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
                <IconButton size="small" color="error" onClick={() => deleteTemplate(t.id)}><DeleteOutlineRoundedIcon sx={{ fontSize: 14 }} /></IconButton>
              </Paper>
            ))}
          </Stack>

          {board && (
            <>
              <Typography variant="caption" sx={{ fontWeight: 800 }}>배경</Typography>
              <Select size="small" fullWidth value={board.background.mode} onChange={(e) => patchCurrentBoard({ background: { ...board.background, mode: e.target.value as 'solid' | 'transparent' | 'image' } })} sx={{ my: 0.5 }}>
                <MenuItem value="solid">단색</MenuItem>
                <MenuItem value="transparent">투명</MenuItem>
                <MenuItem value="image">이미지</MenuItem>
              </Select>
              <Stack direction="row" spacing={0.5} sx={{ mb: 0.5, alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
                {board.background.mode === 'solid' && (
                  <input type="color" value={board.background.color ?? '#f1f5f9'} onChange={(e) => patchCurrentBoard({ background: { ...board.background, color: e.target.value } })} style={{ width: 30, height: 26, border: 'none', background: 'none' }} />
                )}
                {board.background.mode === 'image' && (
                  <Button size="small" onClick={() => bgFileRef.current?.click()}>이미지 업로드</Button>
                )}
                <Chip size="small" label="외곽선" variant={board.background.outline ? 'filled' : 'outlined'} color={board.background.outline ? 'primary' : 'default'} onClick={() => patchCurrentBoard({ background: { ...board.background, outline: !board.background.outline } })} />
                <Chip size="small" label="그림자" variant={board.background.shadow ? 'filled' : 'outlined'} color={board.background.shadow ? 'primary' : 'default'} onClick={() => patchCurrentBoard({ background: { ...board.background, shadow: !board.background.shadow } })} />
                <Chip size="small" label="받침대" variant={board.background.pedestal ? 'filled' : 'outlined'} color={board.background.pedestal ? 'primary' : 'default'} onClick={() => patchCurrentBoard({ background: { ...board.background, pedestal: !board.background.pedestal } })} />
                <Chip size="small" label="라운드" variant={(board.background.radiusMm ?? 0) > 0 ? 'filled' : 'outlined'} color={(board.background.radiusMm ?? 0) > 0 ? 'primary' : 'default'} onClick={() => patchCurrentBoard({ background: { ...board.background, radiusMm: (board.background.radiusMm ?? 0) > 0 ? 0 : 20 } })} />
              </Stack>

              <Divider sx={{ my: 1 }} />
              {/* 요소 추가는 필요할 때만 (+ 버튼 메뉴, §4/§13) */}
              <Button size="small" variant="outlined" fullWidth startIcon={<AddRoundedIcon />} onClick={(e) => setElMenuAnchor(e.currentTarget)} sx={{ mb: 1 }}>+ 요소 추가</Button>

              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" sx={{ fontWeight: 800 }}>제품 (클릭해 배치)</Typography>
              <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                {products.length === 0 && <Typography variant="caption" color="text.secondary">등록된 제품이 없습니다. 편집기 제품 탭에서 추가하세요.</Typography>}
                {products.map((p) => (
                  <Paper key={p.id} variant="outlined" onClick={() => addProductEl(p.id)} sx={{ p: 0.5, display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
                    <Box sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: '#fff', border: '1px solid', borderColor: 'divider', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {productImageUrl(p, p.displayDirection ?? 'front') && <img src={productImageUrl(p, p.displayDirection ?? 'front')} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
                    </Box>
                    <Typography variant="caption" noWrap sx={{ flex: 1 }}>{p.name}</Typography>
                  </Paper>
                ))}
              </Stack>
            </>
          )}
        </Box>

        {/* 중앙: 캔버스 + 정렬 툴바 */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {board ? (
            <>
              <Stack direction="row" spacing={0.5} sx={{ p: 0.5, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap', gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>정렬</Typography>
                <Button size="small" onClick={() => align('left')} disabled={selectedIds.length === 0}>좌</Button>
                <Button size="small" onClick={() => align('hcenter')} disabled={selectedIds.length === 0}>가운데</Button>
                <Button size="small" onClick={() => align('right')} disabled={selectedIds.length === 0}>우</Button>
                <Button size="small" onClick={() => align('top')} disabled={selectedIds.length === 0}>상</Button>
                <Button size="small" onClick={() => align('vcenter')} disabled={selectedIds.length === 0}>중간</Button>
                <Button size="small" onClick={() => align('bottom')} disabled={selectedIds.length === 0}>하</Button>
                <Divider orientation="vertical" flexItem />
                <Button size="small" onClick={() => distribute('h')} disabled={selectedIds.length < 3}>가로 균등</Button>
                <Button size="small" onClick={() => distribute('v')} disabled={selectedIds.length < 3}>세로 균등</Button>
                <Divider orientation="vertical" flexItem />
                <Button size="small" onClick={centerOnBoard} disabled={selectedIds.length === 0}>보드 중앙</Button>
                <Button size="small" onClick={fitToBoard} disabled={selectedIds.length !== 1}>보드 맞춤</Button>
                <Box sx={{ flex: 1 }} />
                {selectedIds.length > 0 && (
                  <>
                    <Button size="small" onClick={() => duplicateElements(selectedIds)}>복제 (Ctrl+D)</Button>
                    <Button size="small" color="error" onClick={() => removeElements(selectedIds)}>삭제 (Del)</Button>
                  </>
                )}
              </Stack>
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <VmdCanvas board={board} products={products} selectedIds={selectedIds} onSelect={onSelect} onChange={updateElement} onCommit={onCommit} registerExport={registerExport} />
              </Box>
            </>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
              <Typography color="text.secondary">보드가 없습니다. 템플릿이나 사이즈로 새 보드를 만들어 시작하세요.</Typography>
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => addBoard(createBoard())}>새 보드 만들기</Button>
            </Box>
          )}
        </Box>

        {/* 우측: 레이어 + 속성 + 제품수 + 프리셋 */}
        <Box sx={{ width: 270, flexShrink: 0, borderLeft: '1px solid', borderColor: 'divider', overflowY: 'auto', p: 1.5 }}>
          {selEl && (
            <>
              <Typography variant="caption" sx={{ fontWeight: 800 }}>선택 요소</Typography>
              <TextField size="small" fullWidth label="이름" value={selEl.name} onChange={(e) => patchSel({ name: e.target.value })} sx={{ my: 0.5 }} />
              {selEl.type === 'text' && (
                <TextField size="small" fullWidth label="텍스트" value={selEl.text ?? ''} onChange={(e) => patchSel({ text: e.target.value })} multiline sx={{ mb: 0.5 }} />
              )}
              <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">투명도</Typography>
                <input type="range" min={0.1} max={1} step={0.05} value={selEl.opacity} onChange={(e) => patchSel({ opacity: Number(e.target.value) })} style={{ flex: 1 }} />
              </Stack>
              {(selEl.type === 'text' || selEl.type === 'shape') && (
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">색</Typography>
                  <input type="color" value={(selEl.type === 'text' ? selEl.color : selEl.fill) ?? '#0f172a'} onChange={(e) => patchSel(selEl.type === 'text' ? { color: e.target.value } : { fill: e.target.value })} style={{ width: 30, height: 24, border: 'none' }} />
                </Stack>
              )}
              <Divider sx={{ my: 1 }} />
            </>
          )}

          <Typography variant="caption" sx={{ fontWeight: 800 }}>레이어</Typography>
          <Stack spacing={0.25} sx={{ my: 0.5, mb: 1 }}>
            {board && [...board.elements].reverse().map((el) => (
              <Paper key={el.id} variant="outlined" onClick={() => onSelect(el.id, false)}
                sx={{ px: 0.5, py: 0.25, display: 'flex', alignItems: 'center', gap: 0.25, cursor: 'pointer', bgcolor: selectedIds.includes(el.id) ? 'primary.50' : 'transparent', borderColor: selectedIds.includes(el.id) ? 'primary.main' : 'divider' }}>
                <Typography variant="caption" noWrap sx={{ flex: 1 }}>{el.name}</Typography>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); updateElement(el.id, { hidden: !el.hidden }); }}>{el.hidden ? <VisibilityOffRoundedIcon sx={{ fontSize: 15 }} /> : <VisibilityRoundedIcon sx={{ fontSize: 15 }} />}</IconButton>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); updateElement(el.id, { locked: !el.locked }); }}>{el.locked ? <LockRoundedIcon sx={{ fontSize: 15 }} /> : <LockOpenRoundedIcon sx={{ fontSize: 15 }} />}</IconButton>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); reorderElement(el.id, 'up'); }}><ArrowUpwardRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); reorderElement(el.id, 'down'); }}><ArrowDownwardRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); removeElements([el.id]); }}><DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
              </Paper>
            ))}
            {board && board.elements.length === 0 && <Typography variant="caption" color="text.secondary">요소가 없습니다.</Typography>}
          </Stack>

          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" sx={{ fontWeight: 800 }}>제품 수량</Typography>
          <Stack spacing={0.25} sx={{ my: 0.5, mb: 1 }}>
            {counts.length === 0 && <Typography variant="caption" color="text.secondary">—</Typography>}
            {counts.map((c) => (
              <Stack key={c.name} direction="row" sx={{ justifyContent: 'space-between' }}>
                <Typography variant="caption" noWrap>{c.name}</Typography>
                <Typography variant="caption" sx={{ fontWeight: 700 }}>{c.count}개</Typography>
              </Stack>
            ))}
          </Stack>

          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" sx={{ fontWeight: 800 }}>프리셋</Typography>
          <Button size="small" fullWidth variant="outlined" sx={{ my: 0.5 }} disabled={!board}
            onClick={() => { const n = window.prompt('프리셋 이름', board?.name ?? 'VMD 프리셋'); if (n) savePreset(n); }}>
            현재 보드 프리셋 저장
          </Button>
          {presets.length > 3 && (
            <TextField size="small" fullWidth placeholder="프리셋 검색" value={presetQuery} onChange={(e) => setPresetQuery(e.target.value)} sx={{ mb: 0.5 }} />
          )}
          <Stack spacing={0.25}>
            {[...presets]
              .filter((p) => !presetQuery.trim() || p.name.toLowerCase().includes(presetQuery.trim().toLowerCase()))
              .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite))
              .map((p) => (
              <Paper key={p.id} variant="outlined" sx={{ px: 0.5, py: 0.25, display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <IconButton size="small" onClick={() => togglePresetFavorite(p.id)}>{p.favorite ? <StarRoundedIcon sx={{ fontSize: 15, color: '#f5b400' }} /> : <StarBorderRoundedIcon sx={{ fontSize: 15 }} />}</IconButton>
                <Typography variant="caption" noWrap sx={{ flex: 1 }}>{p.name}</Typography>
                <Button size="small" onClick={() => loadPreset(p.id)}>불러오기</Button>
                <IconButton size="small" color="error" onClick={() => deletePreset(p.id)}><DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
              </Paper>
            ))}
          </Stack>
          {board && (
            <TextField size="small" fullWidth label="메모" value={board.memo ?? ''} onChange={(e) => patchCurrentBoard({ memo: e.target.value })} multiline minRows={2} sx={{ mt: 1 }} />
          )}
        </Box>
      </Box>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg" style={{ display: 'none' }} onChange={handleFile} />
      <input ref={bgFileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleBgFile} />
    </Box>
  );
}

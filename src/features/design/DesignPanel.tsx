import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import type { BoxFace, DesignMapping, FaceMapping, MappingMode, PlacedFixture } from '../../types';
import { DEFAULT_TEXTURE_TRANSFORM } from '../../types';
import { useEditor } from '../editor/EditorContext';
import { BOX_FACES, MAPPING_MODES, assetById } from './mapping';
import { uploadDesignAsset, isSupportedDesignFile } from '../../firebase/storage';

// 집기 간 매핑 복사용 클립보드 (모듈 수준)
let designClipboard: DesignMapping | null = null;

/**
 * 디자인 매핑 패널 (집기 선택 시, Color 아래).
 *
 * v1.0.6: 한 면 위에 여러 이미지 레이어를 겹쳐 올림(레이어 스택).
 *   - 아래→위 순서로 렌더(마지막이 최상단). base = faces[face], 추가분 = overlays[face].
 *   - 데이터: DesignMapping.faces(기존) + overlays(추가). 기존 저장파일은 base 하나로 그대로 동작 → 100% 호환.
 *   - 각 레이어: 이미지·매핑 방식·위치·크기·회전·투명도·반전을 독립적으로 편집, 순서 변경/삭제 가능.
 */
export default function DesignPanel({ fixture }: { fixture: PlacedFixture }) {
  const { designAssets, addDesignAsset, updateFixtureDesign } = useEditor();
  const [activeFace, setActiveFace] = useState<BoxFace>('front');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const design = fixture.design;
  const face: BoxFace = activeFace; // 편집 중인 홈 면 (레이어가 저장되는 버킷)

  // 선택 면(홈 버킷)의 레이어 스택 (아래→위)
  const stackOf = (f: BoxFace): FaceMapping[] => {
    const base = design?.faces[f];
    const extra = design?.overlays?.[f] ?? [];
    return base ? [base, ...extra] : [...extra];
  };
  const stack = stackOf(face);

  // 레이어의 적용 면 목록 (미지정 레거시면 홈 버킷 면으로 간주)
  const layerFaces = (m: FaceMapping, homeFace: BoxFace): BoxFace[] => m.faces ?? [homeFace];

  const writeStack = (f: BoxFace, next: FaceMapping[]) => {
    const nextFaces = { ...(design?.faces ?? {}) };
    const nextOverlays: NonNullable<DesignMapping['overlays']> = { ...(design?.overlays ?? {}) };
    if (next.length === 0) {
      delete nextFaces[f];
      delete nextOverlays[f];
    } else {
      nextFaces[f] = next[0];
      if (next.length > 1) nextOverlays[f] = next.slice(1);
      else delete nextOverlays[f];
    }
    const overlays = Object.keys(nextOverlays).length > 0 ? nextOverlays : undefined;
    const hasAny = Object.keys(nextFaces).length > 0 || overlays;
    // applyAll(레거시 전역)은 기존 값 보존 — 레이어별 faces 로 대체됨 (v1.0.9)
    const nextDesign: DesignMapping | undefined =
      hasAny ? { applyAll: design?.applyAll ?? false, faces: nextFaces, overlays } : undefined;
    updateFixtureDesign(fixture.id, nextDesign);
  };

  const updateLayer = (idx: number, m: FaceMapping) => {
    const next = [...stack];
    next[idx] = m;
    writeStack(face, next);
  };
  // 레이어별 적용 면 토글 (v1.0.9)
  const toggleLayerFace = (idx: number, target: BoxFace) => {
    const m = stack[idx];
    if (!m) return;
    const cur = layerFaces(m, face);
    const has = cur.includes(target);
    const next = has ? cur.filter((x) => x !== target) : [...cur, target];
    // 최소 1개 면은 유지 (모두 해제 방지)
    updateLayer(idx, { ...m, faces: next.length > 0 ? next : [target] });
  };
  const setLayerAllFaces = (idx: number) => {
    const m = stack[idx];
    if (m) updateLayer(idx, { ...m, faces: BOX_FACES.map((b) => b.value) });
  };
  const patchLayerTransform = (idx: number, patch: Partial<FaceMapping['transform']>) => {
    const m = stack[idx];
    if (m) updateLayer(idx, { ...m, transform: { ...m.transform, ...patch } });
  };
  const deleteLayer = (idx: number) => writeStack(face, stack.filter((_, i) => i !== idx));
  const moveLayer = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= stack.length) return;
    const next = [...stack];
    [next[idx], next[j]] = [next[j], next[idx]];
    writeStack(face, next);
  };

  const handleFiles = async (files: FileList | File[]) => {
    const file = [...files].find(isSupportedDesignFile);
    if (!file) return setError('지원하지 않는 형식입니다 (PNG/JPG/WEBP/SVG).');
    setError(null);
    setUploading(true);
    try {
      const a = await uploadDesignAsset(file);
      addDesignAsset(a);
      // 새 레이어를 맨 위에 추가 (기본 적용 면 = 현재 편집 면)
      writeStack(face, [...stackOf(face), { assetId: a.id, mode: 'contain', transform: { ...DEFAULT_TEXTURE_TRANSFORM }, faces: [face] }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 처리 실패');
    } finally {
      setUploading(false);
    }
  };

  // Ctrl+V 붙여넣기 → 현재 면의 맨 위 레이어로 추가
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const it of items) if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) imgs.push(f);
      }
      if (imgs.length) { e.preventDefault(); void handleFiles(imgs); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture.id, face, design]);

  const renderLayer = (m: FaceMapping, idx: number) => {
    const asset = assetById(designAssets, m.assetId);
    const top = idx === stack.length - 1;
    return (
      <Paper key={idx} variant="outlined" sx={{ p: 1, mb: 0.75 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.25, mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 800 }}>레이어 {idx + 1}{top ? ' · 최상단' : ''}</Typography>
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" title="위로" disabled={idx === stack.length - 1} onClick={() => moveLayer(idx, 1)}><ArrowUpwardRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
          <IconButton size="small" title="아래로" disabled={idx === 0} onClick={() => moveLayer(idx, -1)}><ArrowDownwardRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
          <IconButton size="small" title="변형 초기화" onClick={() => updateLayer(idx, { ...m, transform: { ...DEFAULT_TEXTURE_TRANSFORM } })}><RestartAltRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
          <IconButton size="small" color="error" title="레이어 삭제" onClick={() => deleteLayer(idx)}><DeleteOutlineRoundedIcon sx={{ fontSize: 15 }} /></IconButton>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.75 }}>
          <Box sx={{ width: 48, height: 48, flexShrink: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fff' }}>
            {asset && <img src={asset.url} alt={asset.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
          </Box>
          <Typography variant="caption" noWrap sx={{ flex: 1 }} title={asset?.name}>{asset?.name ?? '이미지 없음'}</Typography>
          <TextField select size="small" value={m.mode} onChange={(e) => updateLayer(idx, { ...m, mode: e.target.value as MappingMode })} sx={{ width: 100 }}>
            {MAPPING_MODES.map((mm) => <MenuItem key={mm.value} value={mm.value}>{mm.label}</MenuItem>)}
          </TextField>
        </Stack>

        {/* 적용 면 (레이어별) — v1.0.9 */}
        <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap', gap: 0.4 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.25 }}>적용 면</Typography>
          {BOX_FACES.map((f) => {
            const on = layerFaces(m, face).includes(f.value);
            return (
              <Chip
                key={f.value}
                label={f.label}
                size="small"
                color={on ? 'primary' : 'default'}
                variant={on ? 'filled' : 'outlined'}
                onClick={() => toggleLayerFace(idx, f.value)}
                sx={{ height: 20, fontSize: 10 }}
              />
            );
          })}
          <Chip label="모든 면" size="small" variant="outlined" onClick={() => setLayerAllFaces(idx)} sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
        </Stack>

        <Typography variant="caption" color="text.secondary">크기 {m.transform.scale.toFixed(2)}×</Typography>
        <Slider size="small" min={0.1} max={3} step={0.05} value={m.transform.scale} onChange={(_, v) => patchLayerTransform(idx, { scale: v as number })} />
        <Stack direction="row" spacing={1}>
          <Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary">X 이동</Typography><Slider size="small" min={-1} max={1} step={0.02} value={m.transform.offsetX} onChange={(_, v) => patchLayerTransform(idx, { offsetX: v as number })} /></Box>
          <Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary">Y 이동</Typography><Slider size="small" min={-1} max={1} step={0.02} value={m.transform.offsetY} onChange={(_, v) => patchLayerTransform(idx, { offsetY: v as number })} /></Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary">회전 {m.transform.rotationDeg}°</Typography><Slider size="small" min={0} max={360} step={1} value={m.transform.rotationDeg} onChange={(_, v) => patchLayerTransform(idx, { rotationDeg: v as number })} /></Box>
          <Box sx={{ flex: 1 }}><Typography variant="caption" color="text.secondary">투명도 {Math.round(m.transform.opacity * 100)}%</Typography><Slider size="small" min={0} max={1} step={0.05} value={m.transform.opacity} onChange={(_, v) => patchLayerTransform(idx, { opacity: v as number })} /></Box>
        </Stack>
        <Stack direction="row" spacing={2}>
          <FormControlLabel control={<Switch size="small" checked={m.transform.flipH} onChange={(e) => patchLayerTransform(idx, { flipH: e.target.checked })} />} label={<Typography variant="caption">좌우 반전</Typography>} sx={{ ml: 0 }} />
          <FormControlLabel control={<Switch size="small" checked={m.transform.flipV} onChange={(e) => patchLayerTransform(idx, { flipV: e.target.checked })} />} label={<Typography variant="caption">상하 반전</Typography>} sx={{ ml: 0 }} />
        </Stack>
      </Paper>
    );
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Divider sx={{ my: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
        디자인 (Design) · {faceLabelKo(face)} 편집 · 레이어 {stack.length}개
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
        레이어마다 <b>적용 면</b>을 선택하세요. (예: 흰 배경 = 모든 면, 로고 = 정면, 장식 = 상판)
      </Typography>

      {/* 편집 면(홈 버킷) 선택 */}
      <ToggleButtonGroup exclusive size="small" value={activeFace} onChange={(_, v) => v && setActiveFace(v as BoxFace)} sx={{ flexWrap: 'wrap', mb: 1 }}>
        {BOX_FACES.map((f) => (
          <ToggleButton key={f.value} value={f.value} sx={{ px: 1, py: 0.25 }}>
            {f.label}{stackOf(f.value).length > 0 ? ` ●${stackOf(f.value).length}` : ''}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

      {/* 레이어 스택 (위가 최상단으로 보이게 역순 표시) */}
      {stack.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          이 면에 매핑이 없습니다. 아래에서 이미지 레이어를 추가하세요.
        </Typography>
      )}
      {stack.map((_, i) => i).reverse().map((i) => renderLayer(stack[i], i))}

      {/* + 매핑(레이어) 추가 — 현재 면 위에 이미지 레이어 추가 */}
      <Button
        size="small"
        variant="outlined"
        fullWidth
        startIcon={<AddRoundedIcon />}
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        sx={{ my: 0.5 }}
      >
        {uploading ? '업로드 중…' : '매핑 추가 (이미지 레이어)'}
      </Button>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        <CloudUploadRoundedIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} /> 드래그·붙여넣기(Ctrl+V)로도 레이어 추가
      </Typography>

      {/* 매핑 복사/붙여넣기 (집기 간) */}
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="text" startIcon={<ContentCopyRoundedIcon />} disabled={!design} onClick={() => { designClipboard = design ?? null; }}>전체 복사</Button>
        <Button size="small" variant="text" startIcon={<ContentPasteRoundedIcon />} disabled={!designClipboard} onClick={() => designClipboard && updateFixtureDesign(fixture.id, JSON.parse(JSON.stringify(designClipboard)))}>붙여넣기</Button>
      </Stack>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) void handleFiles(e.target.files); e.target.value = ''; }}
      />
    </Box>
  );
}

function faceLabelKo(face: BoxFace): string {
  return BOX_FACES.find((f) => f.value === face)?.label ?? face;
}

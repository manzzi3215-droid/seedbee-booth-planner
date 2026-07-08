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
import Paper from '@mui/material/Paper';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
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
 * v1.0.5: 한 집기에 여러 개의 매핑을 리스트로 관리(추가/삭제/각각 옵션).
 *   - 데이터 구조(DesignMapping.faces: 면별 매핑)는 그대로 유지 → 기존 저장파일 100% 호환.
 *   - 각 매핑 = 대상 면(front/back/left/right/top/bottom) + 이미지 + 변형(위치/크기/옵션).
 *   - "모든 면 동일 적용"(applyAll)이면 front 매핑 하나가 전체에 적용됩니다.
 */
export default function DesignPanel({ fixture }: { fixture: PlacedFixture }) {
  const { designAssets, addDesignAsset, updateFixtureDesign } = useEditor();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadFaceRef = useRef<BoxFace>('front');
  const fileRef = useRef<HTMLInputElement>(null);

  const design = fixture.design;
  const applyAll = design?.applyAll ?? false;
  const faces = design?.faces ?? {};

  // 현재 매핑 목록 (applyAll 이면 front 하나만 = 모든 면 적용)
  const usedFaces: BoxFace[] = applyAll
    ? faces.front ? ['front'] : []
    : BOX_FACES.map((f) => f.value).filter((f) => faces[f]);
  const freeFaces: BoxFace[] = BOX_FACES.map((f) => f.value).filter((f) => !faces[f]);

  const commit = (nextFaces: DesignMapping['faces']) => {
    const next: DesignMapping | undefined =
      Object.keys(nextFaces).length > 0 || applyAll ? { applyAll, faces: nextFaces } : undefined;
    updateFixtureDesign(fixture.id, next);
  };
  const setMapping = (face: BoxFace, m: FaceMapping | null) => {
    const nextFaces = { ...faces };
    if (m) nextFaces[face] = m;
    else delete nextFaces[face];
    commit(nextFaces);
  };
  const moveMapping = (from: BoxFace, to: BoxFace) => {
    if (from === to || faces[to]) return;
    const nextFaces = { ...faces };
    nextFaces[to] = nextFaces[from];
    delete nextFaces[from];
    commit(nextFaces);
  };
  const patchTransform = (face: BoxFace, patch: Partial<FaceMapping['transform']>) => {
    const m = faces[face];
    if (m) setMapping(face, { ...m, transform: { ...m.transform, ...patch } });
  };

  const handleFiles = async (face: BoxFace, files: FileList | File[]) => {
    const file = [...files].find(isSupportedDesignFile);
    if (!file) return setError('지원하지 않는 형식입니다 (PNG/JPG/WEBP/SVG).');
    setError(null);
    setUploading(true);
    try {
      const a = await uploadDesignAsset(file);
      addDesignAsset(a);
      setMapping(face, { assetId: a.id, mode: 'contain', transform: { ...DEFAULT_TEXTURE_TRANSFORM } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 처리 실패');
    } finally {
      setUploading(false);
    }
  };
  const pickFile = (face: BoxFace) => {
    uploadFaceRef.current = face;
    fileRef.current?.click();
  };
  const addMapping = () => {
    const face = applyAll ? 'front' : freeFaces[0];
    if (!face) return;
    pickFile(face);
  };

  // Ctrl+V 붙여넣기 → 첫 빈 면(또는 applyAll front)에 추가
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const imgs: File[] = [];
      for (const it of items) if (it.kind === 'file' && it.type.startsWith('image/')) {
        const f = it.getAsFile();
        if (f) imgs.push(f);
      }
      if (imgs.length) {
        const face = applyAll ? 'front' : (freeFaces[0] ?? usedFaces[0]);
        if (face) { e.preventDefault(); void handleFiles(face, imgs); }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture.id, design]);

  const faceLabel = (f: BoxFace) => BOX_FACES.find((x) => x.value === f)?.label ?? f;

  const renderMappingCard = (face: BoxFace, idx: number) => {
    const mapping = faces[face]!;
    const asset = assetById(designAssets, mapping.assetId);
    return (
      <Paper key={face} variant="outlined" sx={{ p: 1, mb: 1 }}>
        <Stack direction="row" sx={{ alignItems: 'center', gap: 0.5, mb: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 800 }}>매핑 {idx + 1}</Typography>
          {!applyAll && (
            <TextField
              select size="small" label="대상 면" value={face}
              onChange={(e) => moveMapping(face, e.target.value as BoxFace)}
              sx={{ width: 110, ml: 0.5 }}
            >
              <MenuItem value={face}>{faceLabel(face)}</MenuItem>
              {freeFaces.map((f) => <MenuItem key={f} value={f}>{faceLabel(f)}</MenuItem>)}
            </TextField>
          )}
          {applyAll && <Typography variant="caption" color="text.secondary">모든 면 적용</Typography>}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" title="변형 초기화" onClick={() => patchTransform(face, DEFAULT_TEXTURE_TRANSFORM)}>
            <RestartAltRoundedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" title="이 매핑 삭제" onClick={() => setMapping(face, null)}>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
          <Box sx={{ width: 56, height: 56, flexShrink: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fff' }}>
            {asset && <img src={asset.url} alt={asset.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />}
          </Box>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" noWrap title={asset?.name}>{asset?.name ?? '이미지 없음'}</Typography>
            <Button size="small" startIcon={<CloudUploadRoundedIcon />} onClick={() => pickFile(face)} disabled={uploading} sx={{ alignSelf: 'flex-start' }}>교체</Button>
          </Stack>
        </Stack>

        <TextField select size="small" label="매핑 방식" value={mapping.mode} fullWidth sx={{ mb: 1 }}
          onChange={(e) => setMapping(face, { ...mapping, mode: e.target.value as MappingMode })}>
          {MAPPING_MODES.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
        </TextField>

        <Typography variant="caption" color="text.secondary">크기 {mapping.transform.scale.toFixed(2)}×</Typography>
        <Slider size="small" min={0.1} max={3} step={0.05} value={mapping.transform.scale} onChange={(_, v) => patchTransform(face, { scale: v as number })} />
        <Typography variant="caption" color="text.secondary">회전 {mapping.transform.rotationDeg}°</Typography>
        <Slider size="small" min={0} max={360} step={1} value={mapping.transform.rotationDeg} onChange={(_, v) => patchTransform(face, { rotationDeg: v as number })} />
        <Stack direction="row" spacing={1}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">X 이동</Typography>
            <Slider size="small" min={-1} max={1} step={0.02} value={mapping.transform.offsetX} onChange={(_, v) => patchTransform(face, { offsetX: v as number })} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">Y 이동</Typography>
            <Slider size="small" min={-1} max={1} step={0.02} value={mapping.transform.offsetY} onChange={(_, v) => patchTransform(face, { offsetY: v as number })} />
          </Box>
        </Stack>
        <Typography variant="caption" color="text.secondary">투명도 {Math.round(mapping.transform.opacity * 100)}%</Typography>
        <Slider size="small" min={0} max={1} step={0.05} value={mapping.transform.opacity} onChange={(_, v) => patchTransform(face, { opacity: v as number })} />
        <Stack direction="row" spacing={2}>
          <FormControlLabel control={<Switch size="small" checked={mapping.transform.flipH} onChange={(e) => patchTransform(face, { flipH: e.target.checked })} />} label={<Typography variant="caption">좌우 반전</Typography>} sx={{ ml: 0 }} />
          <FormControlLabel control={<Switch size="small" checked={mapping.transform.flipV} onChange={(e) => patchTransform(face, { flipV: e.target.checked })} />} label={<Typography variant="caption">상하 반전</Typography>} sx={{ ml: 0 }} />
        </Stack>
      </Paper>
    );
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Divider sx={{ my: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
        디자인 (Design) · 매핑 {usedFaces.length}개
      </Typography>

      {/* 모든 면 동일 적용 */}
      <FormControlLabel
        control={
          <Switch
            size="small"
            checked={applyAll}
            onChange={(e) => updateFixtureDesign(fixture.id, { applyAll: e.target.checked, faces: design?.faces ?? {} })}
          />
        }
        label={<Typography variant="caption">모든 면 동일 적용</Typography>}
        sx={{ ml: 0, mb: 0.5 }}
      />

      {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

      {/* 매핑 리스트 */}
      {usedFaces.length === 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          아직 매핑이 없습니다. 아래에서 매핑을 추가하세요.
        </Typography>
      )}
      {usedFaces.map((f, i) => renderMappingCard(f, i))}

      {/* + 매핑 추가 */}
      <Button
        size="small"
        variant="outlined"
        fullWidth
        startIcon={<AddRoundedIcon />}
        onClick={addMapping}
        disabled={uploading || (!applyAll && freeFaces.length === 0) || (applyAll && usedFaces.length > 0)}
        sx={{ mb: 1 }}
      >
        {uploading ? '업로드 중…' : '매핑 추가'}
      </Button>

      {/* 매핑 복사/붙여넣기 (집기 간) */}
      <Stack direction="row" spacing={1}>
        <Button size="small" variant="text" startIcon={<ContentCopyRoundedIcon />} disabled={!design} onClick={() => { designClipboard = design ?? null; }}>
          전체 복사
        </Button>
        <Button size="small" variant="text" startIcon={<ContentPasteRoundedIcon />} disabled={!designClipboard} onClick={() => designClipboard && updateFixtureDesign(fixture.id, JSON.parse(JSON.stringify(designClipboard)))}>
          붙여넣기
        </Button>
      </Stack>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(uploadFaceRef.current, e.target.files);
          e.target.value = '';
        }}
      />
    </Box>
  );
}

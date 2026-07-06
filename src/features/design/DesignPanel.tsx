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
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
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
 * 디자인 매핑 패널 (집기 선택 시, Color 아래). req #1~9,15,16.
 */
export default function DesignPanel({ fixture }: { fixture: PlacedFixture }) {
  const { designAssets, addDesignAsset, updateFixtureDesign } = useEditor();
  const [activeFace, setActiveFace] = useState<BoxFace>('front');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const design = fixture.design;
  const applyAll = design?.applyAll ?? false;
  const face: BoxFace = applyAll ? 'front' : activeFace;
  const mapping: FaceMapping | undefined = design?.faces[face];
  const asset = mapping ? assetById(designAssets, mapping.assetId) : null;

  const setFaceMapping = (m: FaceMapping | null) => {
    const cur: DesignMapping = design ?? { applyAll, faces: {} };
    const faces = { ...cur.faces };
    if (m) faces[face] = m;
    else delete faces[face];
    const next: DesignMapping | undefined =
      Object.keys(faces).length > 0 || cur.applyAll ? { ...cur, faces } : undefined;
    updateFixtureDesign(fixture.id, next);
  };

  const patchTransform = (patch: Partial<FaceMapping['transform']>) => {
    if (!mapping) return;
    setFaceMapping({ ...mapping, transform: { ...mapping.transform, ...patch } });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const file = [...files].find(isSupportedDesignFile);
    if (!file) return setError('지원하지 않는 형식입니다 (PNG/JPG/WEBP/SVG).');
    setError(null);
    setUploading(true);
    try {
      const a = await uploadDesignAsset(file);
      addDesignAsset(a);
      setFaceMapping({ assetId: a.id, mode: 'contain', transform: { ...DEFAULT_TEXTURE_TRANSFORM } });
    } catch (e) {
      setError(e instanceof Error ? e.message : '이미지 처리 실패');
    } finally {
      setUploading(false);
    }
  };

  // Ctrl+V 붙여넣기 (이미지)
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
        e.preventDefault();
        void handleFiles(imgs);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture.id, face, design]);

  return (
    <Box sx={{ mt: 1 }}>
      <Divider sx={{ my: 1 }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
        디자인 (Design)
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
        sx={{ ml: 0 }}
      />

      {/* 면 선택 */}
      {!applyAll && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={activeFace}
          onChange={(_, v) => v && setActiveFace(v as BoxFace)}
          sx={{ flexWrap: 'wrap', mb: 1 }}
        >
          {BOX_FACES.map((f) => (
            <ToggleButton key={f.value} value={f.value} sx={{ px: 1, py: 0.25 }}>
              {f.label}
              {design?.faces[f.value] ? ' ●' : ''}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}

      {/* 업로드 / 프리뷰 */}
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer?.files?.length) void handleFiles(e.dataTransfer.files);
        }}
        sx={{
          border: '1.5px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 1,
          p: 1,
          textAlign: 'center',
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          mb: 1,
        }}
      >
        {asset ? (
          <Stack spacing={0.5} sx={{ alignItems: 'center' }}>
            <img src={asset.url} alt={asset.name} style={{ maxWidth: '100%', maxHeight: 90, borderRadius: 4, objectFit: 'contain' }} />
            <Typography variant="caption" noWrap sx={{ maxWidth: '100%' }} title={asset.name}>
              {asset.name}
            </Typography>
            <Stack direction="row" spacing={0.5}>
              <Button size="small" startIcon={<CloudUploadRoundedIcon />} onClick={() => fileRef.current?.click()} disabled={uploading}>
                교체
              </Button>
              <IconButton size="small" title="변형 초기화" onClick={() => patchTransform(DEFAULT_TEXTURE_TRANSFORM)}>
                <RestartAltRoundedIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" color="error" title="삭제" onClick={() => setFaceMapping(null)}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        ) : (
          <Button
            size="small"
            startIcon={<CloudUploadRoundedIcon />}
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? '업로드 중…' : '이미지 업로드 · 드래그 · 붙여넣기'}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files?.length) void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </Box>

      {error && <Alert severity="warning" sx={{ mb: 1 }}>{error}</Alert>}

      {/* 매핑 방식 + 변형 */}
      {mapping && (
        <>
          <TextField
            select
            size="small"
            label="매핑 방식"
            value={mapping.mode}
            fullWidth
            sx={{ mb: 1 }}
            onChange={(e) => setFaceMapping({ ...mapping, mode: e.target.value as MappingMode })}
          >
            {MAPPING_MODES.map((m) => (
              <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
            ))}
          </TextField>

          <Typography variant="caption" color="text.secondary">크기 {mapping.transform.scale.toFixed(2)}×</Typography>
          <Slider size="small" min={0.1} max={3} step={0.05} value={mapping.transform.scale} onChange={(_, v) => patchTransform({ scale: v as number })} />

          <Typography variant="caption" color="text.secondary">회전 {mapping.transform.rotationDeg}°</Typography>
          <Slider size="small" min={0} max={360} step={1} value={mapping.transform.rotationDeg} onChange={(_, v) => patchTransform({ rotationDeg: v as number })} />

          <Stack direction="row" spacing={1}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">X 이동</Typography>
              <Slider size="small" min={-1} max={1} step={0.02} value={mapping.transform.offsetX} onChange={(_, v) => patchTransform({ offsetX: v as number })} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="caption" color="text.secondary">Y 이동</Typography>
              <Slider size="small" min={-1} max={1} step={0.02} value={mapping.transform.offsetY} onChange={(_, v) => patchTransform({ offsetY: v as number })} />
            </Box>
          </Stack>

          <Typography variant="caption" color="text.secondary">투명도 {Math.round(mapping.transform.opacity * 100)}%</Typography>
          <Slider size="small" min={0} max={1} step={0.05} value={mapping.transform.opacity} onChange={(_, v) => patchTransform({ opacity: v as number })} />

          <Stack direction="row" spacing={2}>
            <FormControlLabel control={<Switch size="small" checked={mapping.transform.flipH} onChange={(e) => patchTransform({ flipH: e.target.checked })} />} label={<Typography variant="caption">좌우 반전</Typography>} sx={{ ml: 0 }} />
            <FormControlLabel control={<Switch size="small" checked={mapping.transform.flipV} onChange={(e) => patchTransform({ flipV: e.target.checked })} />} label={<Typography variant="caption">상하 반전</Typography>} sx={{ ml: 0 }} />
          </Stack>
        </>
      )}

      {/* 매핑 복사/붙여넣기 (req #16) */}
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button size="small" variant="outlined" startIcon={<ContentCopyRoundedIcon />} disabled={!design} onClick={() => { designClipboard = design ?? null; }}>
          매핑 복사
        </Button>
        <Button size="small" variant="outlined" startIcon={<ContentPasteRoundedIcon />} disabled={!designClipboard} onClick={() => designClipboard && updateFixtureDesign(fixture.id, JSON.parse(JSON.stringify(designClipboard)))}>
          붙여넣기
        </Button>
      </Stack>
    </Box>
  );
}

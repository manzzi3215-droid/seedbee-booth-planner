import { useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import CircularProgress from '@mui/material/CircularProgress';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import type { CustomAsset, FixtureDef } from '../../types';
import { generateId } from '../../utils/id';
import { uploadCustomFixtureImage } from '../../firebase/storage';
import { uploadModelFile } from '../../firebase/modelStorage';

const DEFAULT_CUSTOM_COLOR = '#94a3b8';
const IMG_RE = /\.(png|jpe?g|webp|svg)$/i;
const MODEL_RE = /\.(glb|gltf|obj)$/i;

interface Loaded {
  kind: 'image' | 'model';
  fileName: string;
  mimeType?: string;
  fileUrl?: string; // 이미지 dataURL
  originalWidth?: number;
  originalHeight?: number;
  modelFormat?: 'glb' | 'gltf' | 'obj';
  /** 3D 모델 원본 파일 (저장 시 Storage 업로드 + 로컬 캐시) — v1.1.5 */
  file?: File;
}

/**
 * 커스텀 집기 추가 다이얼로그 (v1.1.1).
 * 이미지(PNG/JPG/WEBP/SVG) 또는 3D 모델(GLB/GLTF/OBJ)을 불러와, 입력한 실물 사이즈(mm)로
 * 집기 라이브러리에 등록합니다. 이미지는 자기완결 dataURL 로 저장, 모델은 메타데이터+placeholder.
 */
export default function CustomFixtureDialog({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (def: FixtureDef) => void | Promise<void>;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [wMm, setWMm] = useState('1200');
  const [dMm, setDMm] = useState('80');
  const [hMm, setHMm] = useState('700');
  const [display2d, setDisplay2d] = useState<NonNullable<CustomAsset['display2d']>>('image-footprint');
  const [display3d, setDisplay3d] = useState<NonNullable<CustomAsset['display3d']>>('panel');
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setLoaded(null);
    setError(null);
    setName('');
    setWMm('1200');
    setDMm('80');
    setHMm('700');
    setDisplay2d('image-footprint');
    setDisplay3d('panel');
    setCategory('');
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isImg = IMG_RE.test(file.name);
    const isModel = MODEL_RE.test(file.name);
    if (!isImg && !isModel) {
      setError('지원 형식: 이미지(PNG·JPG·WEBP·SVG) 또는 3D 모델(GLB·GLTF·OBJ)');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      if (!name) setName(baseName);
      if (isImg) {
        const a = await uploadCustomFixtureImage(file);
        setLoaded({
          kind: 'image',
          fileName: file.name,
          mimeType: file.type,
          fileUrl: a.url,
          originalWidth: a.widthPx,
          originalHeight: a.heightPx,
        });
        setDisplay3d('panel');
        // 이미지 비율로 기본 세로(깊이)는 얇게, 높이는 비율 추정(가로 기준)
        if (a.widthPx && a.heightPx) {
          const ratio = a.heightPx / a.widthPx;
          setHMm(String(Math.max(50, Math.round(Number(wMm || '1200') * ratio))));
        }
      } else {
        const fmt = (file.name.match(MODEL_RE)?.[1].toLowerCase() as 'glb' | 'gltf' | 'obj') ?? 'glb';
        setLoaded({ kind: 'model', fileName: file.name, mimeType: file.type, modelFormat: fmt, file });
        setDisplay3d('placeholder');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const num = (s: string, min = 1) => Math.max(min, Math.round(Number(s) || 0));
  const canSave = !!loaded && name.trim().length > 0 && num(wMm) >= 1 && num(dMm) >= 1 && num(hMm) >= 1;

  const save = async () => {
    if (!loaded || !canSave) return;
    setSaving(true);
    setError(null);
    const defId = generateId();
    try {
      const realW = num(wMm);
      const realD = num(dMm);
      const realH = num(hMm);

      // 3D 모델: Storage 업로드(공유) + 로컬 캐시. URL 은 집기 정의에 저장 (v1.1.5)
      let modelUrl = loaded.fileUrl;
      if (loaded.kind === 'model' && loaded.file) {
        const up = await uploadModelFile(loaded.file, defId);
        modelUrl = up.url ?? undefined;
        if (!up.url && !up.cached) {
          setError('3D 모델 저장에 실패했습니다. 파일 크기(최대 20MB)와 네트워크를 확인해 주세요.');
          setSaving(false);
          return;
        }
      }

      const customAsset: CustomAsset = {
        kind: loaded.kind,
        fileUrl: modelUrl,
        fileName: loaded.fileName,
        mimeType: loaded.mimeType,
        originalWidth: loaded.originalWidth,
        originalHeight: loaded.originalHeight,
        modelFormat: loaded.modelFormat,
        display2d,
        display3d,
        realWidthMm: realW,
        realDepthMm: realD,
        realHeightMm: realH,
        scaleMode: 'fit-real-size',
      };
      const def: FixtureDef = {
        id: defId,
        name: name.trim(),
        shape: 'rectangle',
        widthMm: realW,
        depthMm: realD,
        heightMm: realH,
        color: DEFAULT_CUSTOM_COLOR,
        category: category.trim() || undefined,
        customAsset,
      };
      await onSave(def);
      handleClose();
    } catch (e) {
      // 저장 실패(예: 라이브러리 문서 용량 초과)를 사용자에게 명확히 표시 (v1.1.2)
      console.error('[CustomFixture] save failed', e);
      setError(
        '집기 저장에 실패했습니다. 라이브러리 저장 용량(문서 1MB)을 초과했거나 모델 업로드에 실패했을 수 있습니다. ' +
          '다시 시도해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  const isModel = loaded?.kind === 'model';
  const mm = <InputAdornment position="end">mm</InputAdornment>;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>커스텀 집기 추가 (이미지 / 3D)</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && <Alert severity="warning">{error}</Alert>}

          {/* Step 1. 파일 선택 */}
          <Box>
            <Typography variant="overline" color="text.secondary">1. 파일 선택</Typography>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mt: 0.5 }}>
              <Box sx={{ width: 96, height: 96, flexShrink: 0, border: '1px solid', borderColor: 'divider', borderRadius: 1, bgcolor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {loading ? (
                  <CircularProgress size={22} />
                ) : loaded?.kind === 'image' && loaded.fileUrl ? (
                  <img src={loaded.fileUrl} alt="미리보기" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                ) : loaded?.kind === 'model' ? (
                  <ViewInArRoundedIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
                ) : (
                  <UploadFileRoundedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
                )}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => fileRef.current?.click()} disabled={loading}>
                  파일 불러오기
                </Button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg,.glb,.gltf,.obj" style={{ display: 'none' }} onChange={onFile} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  이미지: PNG·JPG·WEBP·SVG · 3D: GLB·GLTF·OBJ
                </Typography>
                {loaded && (
                  <Chip size="small" label={`${loaded.fileName}`} sx={{ mt: 0.5, maxWidth: '100%' }} />
                )}
              </Box>
            </Stack>
          </Box>

          {/* Step 2. 크기 입력 */}
          <Box>
            <Typography variant="overline" color="text.secondary">2. 실물 사이즈</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <TextField size="small" label="가로" type="number" value={wMm} onChange={(e) => setWMm(e.target.value)} slotProps={{ input: { endAdornment: mm } }} />
              <TextField size="small" label="깊이" type="number" value={dMm} onChange={(e) => setDMm(e.target.value)} slotProps={{ input: { endAdornment: mm } }} />
              <TextField size="small" label="높이" type="number" value={hMm} onChange={(e) => setHMm(e.target.value)} slotProps={{ input: { endAdornment: mm } }} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              이미지 원본 크기와 관계없이 입력한 실물 사이즈 기준으로 배치됩니다. 2D는 바닥 점유 면적(가로×깊이), 3D는 높이까지 자동 스케일됩니다.
            </Typography>
          </Box>

          {/* Step 3. 표시 방식 */}
          <Box>
            <Typography variant="overline" color="text.secondary">3. 표시 방식</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <TextField size="small" select label="2D 표시" value={display2d} onChange={(e) => setDisplay2d(e.target.value as typeof display2d)} fullWidth disabled={isModel}>
                <MenuItem value="image-footprint">이미지 + 사각 footprint</MenuItem>
                <MenuItem value="image">이미지만</MenuItem>
                <MenuItem value="footprint">사각형 footprint만</MenuItem>
              </TextField>
              <TextField size="small" select label="3D 표시" value={display3d} onChange={(e) => setDisplay3d(e.target.value as typeof display3d)} fullWidth>
                {isModel ? (
                  [<MenuItem key="placeholder" value="placeholder">Placeholder 박스</MenuItem>]
                ) : (
                  [
                    <MenuItem key="panel" value="panel">세운 판넬(전면 이미지)</MenuItem>,
                    <MenuItem key="box-texture" value="box-texture">박스 전체 텍스처</MenuItem>,
                    <MenuItem key="top-texture" value="top-texture">상판 이미지</MenuItem>,
                    <MenuItem key="billboard" value="billboard">빌보드(정면)</MenuItem>,
                  ]
                )}
              </TextField>
            </Stack>
            {isModel && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <b>GLB/GLTF</b> 모델은 3D 미리보기에서 입력한 실물 사이즈로 <b>실제 렌더링</b>됩니다(바닥 접지·회전 반영). 불러오기에 실패하면 회색 박스로 대체 표시됩니다. OBJ 는 아직 박스로 표시됩니다.
              </Alert>
            )}
          </Box>

          {/* Step 4. 이름 · 카테고리 */}
          <Box>
            <Typography variant="overline" color="text.secondary">4. 이름 · 폴더</Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <TextField size="small" label="집기명 *" value={name} onChange={(e) => setName(e.target.value)} fullWidth />
              <TextField size="small" label="폴더/카테고리" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="예) 가전, 사인물" fullWidth />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={handleClose} disabled={saving}>취소</Button>
        <Button variant="contained" onClick={save} disabled={!canSave || saving}>집기로 저장</Button>
      </DialogActions>
    </Dialog>
  );
}

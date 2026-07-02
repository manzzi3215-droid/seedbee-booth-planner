import { useEffect, useRef, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Slider from '@mui/material/Slider';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import FitScreenRoundedIcon from '@mui/icons-material/FitScreenRounded';
import { useEditor } from '../editor/EditorContext';
import { buildIsoScene } from './scene';
import {
  renderIsoSceneToDataURL,
  VIEWPOINTS,
  DEFAULT_ISO_OPTIONS,
  type IsoRenderOptions,
  type IsoViewpointId,
} from './renderIso';
import { preloadImages, buildBaseName, downloadDataURL } from '../export/download';
import { WALL_SIDES } from '../wall/constants';

/** 미리보기 렌더 해상도 (출력은 품질 옵션 별도) */
const PREVIEW_PX = 1400;

const QUALITY_OPTIONS = [
  { value: 1920, label: '기본 (1920px)' },
  { value: 3840, label: '고화질 (3840px)' },
  { value: 6000, label: '인쇄용 (6000px)' },
];

/**
 * 아이소메트릭 3D 미리보기 Dialog (preview only, 편집 없음).
 * 시점/줌/그림자/벽 투명도/바닥/집기명 등을 조절할 수 있습니다.
 * 렌더는 Dialog 가 열릴 때만 수행하고, 닫으면 상태를 정리합니다(편집기 성능 무관).
 */
export default function IsoPreviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, placed, fixturesById, planImages, wallItems, layouts, currentLayoutId } = useEditor();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [quality, setQuality] = useState(1920);
  const [opts, setOpts] = useState<IsoRenderOptions>(DEFAULT_ISO_OPTIONS);
  const imageElsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const setOpt = <K extends keyof IsoRenderOptions>(key: K, value: IsoRenderOptions[K]) =>
    setOpts((o) => ({ ...o, [key]: value }));

  // 열릴 때 이미지 preload → ready. 닫힐 때 정리.
  useEffect(() => {
    if (!open || !project) {
      setDataUrl(null);
      setReady(false);
      setZoom(1);
      imageElsRef.current = new Map();
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const srcs = [
        ...planImages.map((i) => i.srcDataUrl),
        ...WALL_SIDES.flatMap((s) => wallItems[s].images.map((i) => i.srcDataUrl)),
      ];
      const imageEls = await preloadImages(srcs);
      if (!active) return;
      imageElsRef.current = imageEls;
      setReady(true);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [open, project, planImages, wallItems]);

  // 옵션/데이터 변경 시 미리보기 재렌더 (동기, 로드된 이미지 재사용)
  useEffect(() => {
    if (!open || !project || !ready) return;
    const scene = buildIsoScene(project.boothConfig, placed, fixturesById, planImages, wallItems);
    const url = renderIsoSceneToDataURL(scene, imageElsRef.current, { ...opts, targetPx: PREVIEW_PX });
    setDataUrl(url);
  }, [open, ready, opts, project, placed, fixturesById, planImages, wallItems]);

  const layoutName = layouts.find((l) => l.id === currentLayoutId)?.name ?? '미저장';

  const handleExport = () => {
    if (!project || !ready) return;
    const scene = buildIsoScene(project.boothConfig, placed, fixturesById, planImages, wallItems);
    const url = renderIsoSceneToDataURL(scene, imageElsRef.current, { ...opts, targetPx: quality });
    downloadDataURL(url, `${buildBaseName(project.name, layoutName)}_isometric.png`);
  };

  const clampZoom = (z: number) => Math.max(0.4, Math.min(4, z));
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>아이소메트릭 미리보기</DialogTitle>
      <DialogContent dividers>
        {/* 시점 선택 + 줌 + 품질 */}
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 1.5, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            color="primary"
            value={opts.viewpoint}
            onChange={(_, v) => v && setOpt('viewpoint', v as IsoViewpointId)}
          >
            {VIEWPOINTS.map((vp) => (
              <ToggleButton key={vp.id} value={vp.id} sx={{ px: 1.5 }}>
                {vp.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Box sx={{ flex: 1 }} />

          <Tooltip title="축소">
            <IconButton size="small" onClick={() => setZoom((z) => clampZoom(z / 1.2))}>
              <RemoveRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ minWidth: 42, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <Tooltip title="확대">
            <IconButton size="small" onClick={() => setZoom((z) => clampZoom(z * 1.2))}>
              <AddRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="화면 맞춤">
            <IconButton size="small" onClick={() => setZoom(1)}>
              <FitScreenRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* 렌더 옵션 */}
        <Stack
          direction="row"
          spacing={2}
          sx={{ mb: 1.5, alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}
        >
          <Box sx={{ minWidth: 180 }}>
            <Typography variant="caption" color="text.secondary">
              벽 투명도 {Math.round(opts.wallOpacity * 100)}%
            </Typography>
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.02}
              value={opts.wallOpacity}
              onChange={(_, v) => setOpt('wallOpacity', v as number)}
            />
          </Box>

          <Divider orientation="vertical" flexItem />

          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              바닥색
            </Typography>
            <input
              type="color"
              value={opts.floorColor}
              onChange={(e) => setOpt('floorColor', e.target.value)}
              style={{ width: 32, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
            />
          </Stack>

          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={opts.floorChecker}
                onChange={(e) => setOpt('floorChecker', e.target.checked)}
              />
            }
            label={<Typography variant="caption">체크 패턴</Typography>}
            sx={{ ml: 0 }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={opts.showShadows}
                onChange={(e) => setOpt('showShadows', e.target.checked)}
              />
            }
            label={<Typography variant="caption">그림자</Typography>}
            sx={{ ml: 0 }}
          />
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={opts.showNames}
                onChange={(e) => setOpt('showNames', e.target.checked)}
              />
            }
            label={<Typography variant="caption">집기명</Typography>}
            sx={{ ml: 0 }}
          />

          <Divider orientation="vertical" flexItem />

          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              화질
            </Typography>
            <Select size="small" value={quality} onChange={(e) => setQuality(Number(e.target.value))}>
              {QUALITY_OPTIONS.map((q) => (
                <MenuItem key={q.value} value={q.value}>
                  {q.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>
        </Stack>

        {/* 미리보기 영역 */}
        <Box
          onWheel={onWheel}
          sx={{
            height: '62vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#eef1f5',
            borderRadius: 1,
            overflow: 'auto',
          }}
        >
          {loading && <CircularProgress />}
          {!loading && dataUrl && (
            <img
              src={dataUrl}
              alt="아이소메트릭 미리보기"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center',
                maxWidth: '100%',
                maxHeight: '100%',
                transition: 'transform 0.08s',
              }}
            />
          )}
          {!loading && !dataUrl && (
            <Typography variant="body2" color="text.secondary">
              미리보기를 생성할 수 없습니다.
            </Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          편집 없는 미리보기입니다. 배치는 평면도/벽면에서 수정하세요. 마우스 휠로 확대/축소할 수 있습니다.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          닫기
        </Button>
        <Button variant="contained" startIcon={<ImageRoundedIcon />} onClick={handleExport} disabled={!ready}>
          PNG 저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}

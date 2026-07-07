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
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import ThreeSixtyRoundedIcon from '@mui/icons-material/ThreeSixtyRounded';
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
import type { EnvironmentId } from '../../types';
import { ENVIRONMENTS, environmentDef, floorMaterialDef, wallMaterialDef } from '../styling/styling';
import {
  type LightingConfig,
  type Light,
  defaultLighting,
  SUN_PRESETS,
  COLOR_TEMPS,
} from './lighting/LightingEngine';

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
  const { project, placed, fixturesById, planImages, wallItems, designAssets, placedProducts, products, layouts, currentLayoutId } = useEditor();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [quality, setQuality] = useState(1920);
  const [opts, setOpts] = useState<IsoRenderOptions>(DEFAULT_ISO_OPTIONS);
  const imageElsRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // 자유 궤도 카메라 (v0.9.1)
  const [azimuthDeg, setAzimuthDeg] = useState(VIEWPOINTS[0].azimuthDeg);
  const [elevationDeg, setElevationDeg] = useState(VIEWPOINTS[0].elevationDeg);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [orbitSpeed, setOrbitSpeed] = useState<'slow' | 'normal' | 'fast'>('normal');
  const dragRef = useRef<{ mode: 'orbit' | 'pan'; x: number; y: number } | null>(null);

  // Styling: 환경/벽색/투명배경 (v0.9.8)
  const [environment, setEnvironment] = useState<EnvironmentId>('studioWhite');
  const [wallColor, setWallColor] = useState('#c3ccd8');
  const [transparentBg, setTransparentBg] = useState(false);

  // 조명 (v0.9.2)
  const [lighting, setLighting] = useState<LightingConfig>(defaultLighting);
  const amb = lighting.lights.find((l) => l.type === 'ambient');
  const dir = lighting.lights.find((l) => l.type === 'directional');
  const spot = lighting.lights.find((l) => l.type === 'spot');
  const updateLight = (type: Light['type'], patch: Partial<Light>) =>
    setLighting((cfg) => ({ ...cfg, lights: cfg.lights.map((l) => (l.type === type ? ({ ...l, ...patch } as Light) : l)) }));
  const setShadowCfg = (patch: Partial<LightingConfig['shadow']>) =>
    setLighting((cfg) => ({ ...cfg, shadow: { ...cfg.shadow, ...patch } }));
  const activeSun =
    dir && dir.type === 'directional'
      ? SUN_PRESETS.find((s) => Math.abs(s.azimuthDeg - dir.azimuthDeg) < 1 && Math.abs(s.elevationDeg - dir.elevationDeg) < 1)?.id ?? null
      : null;

  const applyViewpoint = (id: IsoViewpointId) => {
    const vp = VIEWPOINTS.find((v) => v.id === id);
    if (!vp) return;
    setAzimuthDeg(vp.azimuthDeg);
    setElevationDeg(vp.elevationDeg);
    setPan({ x: 0, y: 0 });
  };
  // 현재 az/el 이 어떤 프리셋과 일치하는지(하이라이트용)
  const activeViewpoint =
    VIEWPOINTS.find((v) => Math.abs(((v.azimuthDeg - azimuthDeg) % 360)) < 0.5 && Math.abs(v.elevationDeg - elevationDeg) < 0.5)?.id ?? null;

  const setOpt = <K extends keyof IsoRenderOptions>(key: K, value: IsoRenderOptions[K]) =>
    setOpts((o) => ({ ...o, [key]: value }));

  // 열릴 때 프로젝트 스타일링(바닥/벽 재질·환경)을 미리보기 옵션으로 시드 (v0.9.8)
  useEffect(() => {
    if (!open || !project) return;
    const s = project.boothConfig.styling ?? {};
    const fm = floorMaterialDef(s.floorMaterial);
    setOpts((o) => ({ ...o, floorColor: fm.color, floorChecker: fm.checker }));
    setWallColor(wallMaterialDef(s.wallMaterial).color);
    setEnvironment(s.environment ?? 'studioWhite');
    setTransparentBg(false);
  }, [open, project]);

  // 열릴 때 이미지 preload → ready. 닫힐 때 정리.
  useEffect(() => {
    if (!open || !project) {
      setDataUrl(null);
      setReady(false);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setAutoOrbit(false);
      imageElsRef.current = new Map();
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const srcs = [
        ...planImages.map((i) => i.srcDataUrl),
        ...WALL_SIDES.flatMap((s) => wallItems[s].images.map((i) => i.srcDataUrl)),
        ...designAssets.map((a) => a.url),
        ...products.map((p) => p.thumbnailUrl).filter((u): u is string => !!u),
        ...products.flatMap((p) => Object.values(p.images ?? {})).filter((u): u is string => !!u),
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
  }, [open, project, planImages, wallItems, designAssets, products]);

  // 옵션/카메라/데이터 변경 시 미리보기 재렌더 (동기, 로드된 이미지 재사용)
  useEffect(() => {
    if (!open || !project || !ready) return;
    const scene = buildIsoScene(project.boothConfig, placed, fixturesById, planImages, wallItems, designAssets, placedProducts, products);
    const env = environmentDef(environment);
    const url = renderIsoSceneToDataURL(scene, imageElsRef.current, {
      ...opts, wallColor, envBgTop: env.bgTop, envBgBottom: env.bgBottom, transparentBg: false,
      azimuthDeg, elevationDeg, lighting, targetPx: PREVIEW_PX,
    });
    setDataUrl(url);
  }, [open, ready, opts, environment, wallColor, azimuthDeg, elevationDeg, lighting, project, placed, fixturesById, planImages, wallItems, designAssets, placedProducts, products]);

  // 자동 회전(Auto Orbit) — 360° 연속 회전
  useEffect(() => {
    if (!autoOrbit || !open) return;
    const stepDeg = orbitSpeed === 'slow' ? 0.4 : orbitSpeed === 'fast' ? 1.8 : 0.9;
    const timer = setInterval(() => setAzimuthDeg((a) => (a + stepDeg) % 360), 40);
    return () => clearInterval(timer);
  }, [autoOrbit, orbitSpeed, open]);

  const layoutName = layouts.find((l) => l.id === currentLayoutId)?.name ?? '미저장';

  const handleExport = () => {
    if (!project || !ready) return;
    const scene = buildIsoScene(project.boothConfig, placed, fixturesById, planImages, wallItems, designAssets, placedProducts, products);
    const env = environmentDef(environment);
    const url = renderIsoSceneToDataURL(scene, imageElsRef.current, {
      ...opts, wallColor, envBgTop: env.bgTop, envBgBottom: env.bgBottom,
      transparentBg: transparentBg || !!env.transparent,
      azimuthDeg, elevationDeg, lighting, targetPx: quality,
    });
    downloadDataURL(url, `${buildBaseName(project.name, layoutName)}_isometric.png`);
  };

  const clampZoom = (z: number) => Math.max(0.4, Math.min(4, z));
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
  };

  // 마우스 드래그: 좌드래그=궤도 회전(orbit), Shift+드래그=패닝(pan)
  const onDragStart = (e: React.MouseEvent) => {
    dragRef.current = { mode: e.shiftKey ? 'pan' : 'orbit', x: e.clientX, y: e.clientY };
  };
  const onDragMove = (e: React.MouseEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    d.x = e.clientX;
    d.y = e.clientY;
    if (d.mode === 'pan') {
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      setAzimuthDeg((a) => (a - dx * 0.4 + 360) % 360);
      setElevationDeg((el) => Math.max(20, Math.min(90, el - dy * 0.3)));
    }
  };
  const onDragEnd = () => {
    dragRef.current = null;
  };
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
            value={activeViewpoint}
            onChange={(_, v) => v && applyViewpoint(v as IsoViewpointId)}
          >
            {VIEWPOINTS.map((vp) => (
              <ToggleButton key={vp.id} value={vp.id} sx={{ px: 1.5 }}>
                {vp.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {/* Auto Orbit (자동 회전) */}
          <Tooltip title={autoOrbit ? '자동 회전 정지' : '자동 회전 (360°)'}>
            <IconButton size="small" color={autoOrbit ? 'primary' : 'default'} onClick={() => setAutoOrbit((v) => !v)}>
              {autoOrbit ? <PauseRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <ThreeSixtyRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          <ToggleButtonGroup
            exclusive
            size="small"
            value={orbitSpeed}
            onChange={(_, v) => v && setOrbitSpeed(v)}
          >
            <ToggleButton value="slow" sx={{ px: 1, py: 0.25 }}>Slow</ToggleButton>
            <ToggleButton value="normal" sx={{ px: 1, py: 0.25 }}>Normal</ToggleButton>
            <ToggleButton value="fast" sx={{ px: 1, py: 0.25 }}>Fast</ToggleButton>
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
          <Tooltip title="화면 맞춤(줌·이동 초기화)">
            <IconButton size="small" onClick={resetView}>
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
              벽색
            </Typography>
            <input
              type="color"
              value={wallColor}
              onChange={(e) => setWallColor(e.target.value)}
              style={{ width: 32, height: 28, border: 'none', background: 'none', cursor: 'pointer' }}
            />
          </Stack>

          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">
              환경
            </Typography>
            <Select size="small" value={environment} onChange={(e) => setEnvironment(e.target.value as EnvironmentId)}>
              {ENVIRONMENTS.map((env) => (
                <MenuItem key={env.id} value={env.id}>
                  {env.label}
                </MenuItem>
              ))}
            </Select>
          </Stack>

          <FormControlLabel
            control={<Switch size="small" checked={transparentBg} onChange={(e) => setTransparentBg(e.target.checked)} />}
            label={<Typography variant="caption">배경 투명(저장)</Typography>}
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

        {/* 조명(Lighting) 패널 — v0.9.2 */}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 1.5, p: 1, alignItems: 'center', flexWrap: 'wrap', gap: 1.25, bgcolor: 'action.hover', borderRadius: 1 }}
        >
          <Typography variant="caption" sx={{ fontWeight: 800 }}>조명</Typography>

          <Box sx={{ minWidth: 110 }}>
            <Typography variant="caption" color="text.secondary">Ambient {Math.round((amb?.intensity ?? 0) * 100)}%</Typography>
            <Slider size="small" min={0} max={1.5} step={0.05} value={amb?.intensity ?? 0} onChange={(_, v) => updateLight('ambient', { intensity: v as number })} />
          </Box>
          <Box sx={{ minWidth: 110 }}>
            <Typography variant="caption" color="text.secondary">Directional {Math.round((dir?.intensity ?? 0) * 100)}%</Typography>
            <Slider size="small" min={0} max={1.5} step={0.05} value={dir?.intensity ?? 0} onChange={(_, v) => updateLight('directional', { intensity: v as number })} />
          </Box>

          <Divider orientation="vertical" flexItem />

          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">태양</Typography>
            <ToggleButtonGroup
              exclusive size="small" value={activeSun}
              onChange={(_, v) => {
                const p = SUN_PRESETS.find((s) => s.id === v);
                if (p) updateLight('directional', { azimuthDeg: p.azimuthDeg, elevationDeg: p.elevationDeg });
              }}
            >
              {SUN_PRESETS.map((s) => (
                <ToggleButton key={s.id} value={s.id} sx={{ px: 1, py: 0.25 }}>{s.label}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Stack>

          <Divider orientation="vertical" flexItem />

          <FormControlLabel
            control={<Switch size="small" checked={spot?.enabled ?? false} onChange={(e) => updateLight('spot', { enabled: e.target.checked })} />}
            label={<Typography variant="caption">Spot</Typography>}
            sx={{ ml: 0 }}
          />
          {spot?.enabled && spot.type === 'spot' && (
            <>
              <Box sx={{ minWidth: 90 }}>
                <Typography variant="caption" color="text.secondary">세기 {Math.round(spot.intensity * 100)}%</Typography>
                <Slider size="small" min={0} max={1.5} step={0.05} value={spot.intensity} onChange={(_, v) => updateLight('spot', { intensity: v as number })} />
              </Box>
              <Box sx={{ minWidth: 90 }}>
                <Typography variant="caption" color="text.secondary">각도 {spot.angleDeg}°</Typography>
                <Slider size="small" min={10} max={80} step={1} value={spot.angleDeg} onChange={(_, v) => updateLight('spot', { angleDeg: v as number })} />
              </Box>
            </>
          )}

          <Divider orientation="vertical" flexItem />

          <FormControlLabel
            control={<Switch size="small" checked={lighting.shadow.enabled} onChange={(e) => setShadowCfg({ enabled: e.target.checked })} />}
            label={<Typography variant="caption">그림자</Typography>}
            sx={{ ml: 0 }}
          />
          <Box sx={{ minWidth: 90 }}>
            <Typography variant="caption" color="text.secondary">부드러움</Typography>
            <Slider size="small" min={0} max={1} step={0.05} value={lighting.shadow.softness} onChange={(_, v) => setShadowCfg({ softness: v as number })} disabled={!lighting.shadow.enabled} />
          </Box>
          <FormControlLabel
            control={<Switch size="small" checked={lighting.shadow.contact} onChange={(e) => setShadowCfg({ contact: e.target.checked })} disabled={!lighting.shadow.enabled} />}
            label={<Typography variant="caption">접지</Typography>}
            sx={{ ml: 0 }}
          />

          <Divider orientation="vertical" flexItem />

          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary">색온도</Typography>
            <Select size="small" value={lighting.colorTempK} onChange={(e) => setLighting((cfg) => ({ ...cfg, colorTempK: Number(e.target.value) }))}>
              {COLOR_TEMPS.map((k) => (
                <MenuItem key={k} value={k}>{k}K</MenuItem>
              ))}
            </Select>
          </Stack>

          <Box sx={{ minWidth: 90 }}>
            <Typography variant="caption" color="text.secondary">바닥반사 {Math.round(lighting.groundReflection * 100)}%</Typography>
            <Slider size="small" min={0} max={1} step={0.05} value={lighting.groundReflection} onChange={(_, v) => setLighting((cfg) => ({ ...cfg, groundReflection: v as number }))} />
          </Box>
        </Stack>

        {/* 미리보기 영역 — 드래그: 궤도 회전 / Shift+드래그: 이동 / 휠: 확대·축소 */}
        <Box
          onWheel={onWheel}
          onMouseDown={onDragStart}
          onMouseMove={onDragMove}
          onMouseUp={onDragEnd}
          onMouseLeave={onDragEnd}
          sx={{
            height: '62vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#eef1f5',
            borderRadius: 1,
            overflow: 'hidden',
            cursor: 'grab',
            '&:active': { cursor: 'grabbing' },
            userSelect: 'none',
          }}
        >
          {loading && <CircularProgress />}
          {!loading && dataUrl && (
            <img
              src={dataUrl}
              alt="아이소메트릭 미리보기"
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center',
                maxWidth: '100%',
                maxHeight: '100%',
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
          편집 없는 미리보기입니다. <b>드래그</b>로 궤도 회전, <b>Shift+드래그</b>로 이동, <b>휠</b>로 확대/축소, <b>▶</b>로 360° 자동 회전.
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

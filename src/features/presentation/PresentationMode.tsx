import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Divider from '@mui/material/Divider';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import PhotoCameraRoundedIcon from '@mui/icons-material/PhotoCameraRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import BrandingWatermarkRoundedIcon from '@mui/icons-material/BrandingWatermarkRounded';
import type { WallSide } from '../../types';
import { useEditor } from '../editor/EditorContext';
import { createBoothDrawingDataURL } from '../export/renderBooth';
import { createWallDrawingDataURL } from '../export/renderWall';
import { buildIsoScene } from '../iso/scene';
import {
  renderIsoSceneToDataURL,
  VIEWPOINTS,
  DEFAULT_ISO_OPTIONS,
  type IsoViewpointId,
} from '../iso/renderIso';
import { preloadImages, downloadDataURL, buildBaseName } from '../export/download';
import { WALL_SIDES, getViewModeLabel, getWallLengthMm, isWallEnabled } from '../wall/constants';
import { hasBoothHeight } from '../../constants/booth';
import { storage } from '../../storage';
import { generateId } from '../../utils/id';

type PresMode = '2d' | '3d' | 'wall';
type Theme = 'light' | 'dark';

/** 화면 표시용 렌더 해상도(긴 변 px). 스크린샷/PDF 는 별도 고해상도 */
const DISPLAY_PX = 1680;
const SCREENSHOT_PX: Record<string, number> = { HD: 1600, FHD: 2400, '4K': 3840 };
const WALKTHROUGH_MS = 2600;

/**
 * Presentation Mode (고객 시안 검토 모드) — v0.8.8.
 *
 * 편집 UI(패널/그리드/치수/선택 핸들 등)를 모두 숨기고, 오프스크린 렌더러로
 * 만든 깨끗한 이미지(2D/3D/벽면)를 전체 화면으로 보여줍니다. 편집은 하지 않습니다.
 * 기존 렌더러(renderBooth/renderIso/renderWall)를 그대로 재사용하므로 편집기와 결과가 일치합니다.
 */
export default function PresentationMode({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    project,
    placed,
    texts,
    dimensions,
    planImages,
    planBackgrounds,
    designAssets,
    fixturesById,
    showFixtureNames,
    wallItems,
    layouts,
    currentLayoutId,
  } = useEditor();

  const rootRef = useRef<HTMLDivElement>(null);
  const [imageEls, setImageEls] = useState<Map<string, HTMLImageElement>>(new Map());
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<PresMode>('2d');
  const [viewpoint, setViewpoint] = useState<IsoViewpointId>('frontDiagonal');
  const [wallSide, setWallSide] = useState<WallSide>('frontWall');
  const [designOn, setDesignOn] = useState(true);
  const [theme, setTheme] = useState<Theme>('light');
  const [brandOn, setBrandOn] = useState(true);
  const [watermarkOn, setWatermarkOn] = useState(false);
  const [walkthrough, setWalkthrough] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [shotAnchor, setShotAnchor] = useState<null | HTMLElement>(null);

  const booth = project?.boothConfig ?? null;
  const heightSet = booth ? hasBoothHeight(booth) : false;
  const layoutName = layouts.find((l) => l.id === currentLayoutId)?.name ?? '미저장';
  const brandLabel = project?.name || 'Booth Layout Planner';

  // 사용 가능한 벽면 목록
  const enabledWalls = useMemo(
    () => (booth ? WALL_SIDES.filter((s) => isWallEnabled(booth, s)) : []),
    [booth],
  );

  // 열릴 때 이미지 preload. 닫히면 정리.
  useEffect(() => {
    if (!open || !project) {
      setReady(false);
      setImageEls(new Map());
      setWalkthrough(false);
      return;
    }
    let active = true;
    setReady(false);
    (async () => {
      const wallImgs = WALL_SIDES.flatMap((s) => wallItems[s].images.map((i) => i.srcDataUrl));
      const srcs = [
        ...planBackgrounds.map((i) => i.srcDataUrl),
        ...planImages.map((i) => i.srcDataUrl),
        ...designAssets.map((a) => a.url),
        ...wallImgs,
      ];
      const els = await preloadImages(srcs);
      if (!active) return;
      setImageEls(els);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, [open, project, planImages, planBackgrounds, designAssets, wallItems]);

  // 높이 미설정 시 3D/벽면 불가 → 2D 강제
  useEffect(() => {
    if ((mode === '3d' || mode === 'wall') && !heightSet) setMode('2d');
  }, [mode, heightSet]);

  // 벽면 모드 진입 시 사용 가능한 벽면으로 보정
  useEffect(() => {
    if (mode === 'wall' && enabledWalls.length > 0 && !enabledWalls.includes(wallSide)) {
      setWallSide(enabledWalls[0]);
    }
  }, [mode, enabledWalls, wallSide]);

  // ── 렌더 헬퍼 (오프스크린 렌더러 재사용) ──
  const render2D = useCallback(
    (px: number, withDesign: boolean): string => {
      if (!booth) return '';
      return createBoothDrawingDataURL(
        booth,
        placed,
        texts,
        dimensions,
        planImages,
        planBackgrounds,
        imageEls,
        fixturesById,
        showFixtureNames,
        { designAssets: withDesign ? designAssets : [], showGrid: false, showDimensions: false, pixelRatio: px / 1500 },
      );
    },
    [booth, placed, texts, dimensions, planImages, planBackgrounds, imageEls, fixturesById, showFixtureNames, designAssets],
  );

  const render3D = useCallback(
    (vp: IsoViewpointId, px: number, withDesign: boolean): string => {
      if (!booth) return '';
      const scene = buildIsoScene(booth, placed, fixturesById, planImages, wallItems, withDesign ? designAssets : []);
      return renderIsoSceneToDataURL(scene, imageEls, {
        ...DEFAULT_ISO_OPTIONS,
        viewpoint: vp,
        targetPx: px,
        floorColor: theme === 'dark' ? '#334155' : '#e2e8f0',
        background: theme,
      });
    },
    [booth, placed, fixturesById, planImages, wallItems, designAssets, imageEls, theme],
  );

  const renderWall = useCallback(
    (side: WallSide, px: number): string => {
      if (!booth) return '';
      const g = wallItems[side];
      return createWallDrawingDataURL(
        getWallLengthMm(booth, side),
        booth.heightMm ?? 0,
        g.texts,
        g.dimensions,
        g.images,
        imageEls,
        { pixelRatio: px / 1500 },
      );
    },
    [booth, wallItems, imageEls],
  );

  const renderCurrent = useCallback(
    (px: number): string => {
      try {
        if (mode === '3d') return render3D(viewpoint, px, designOn);
        if (mode === 'wall') return renderWall(wallSide, px);
        return render2D(px, designOn);
      } catch {
        return '';
      }
    },
    [mode, viewpoint, wallSide, designOn, render2D, render3D, renderWall],
  );

  // 화면 표시용 이미지
  const displayUrl = useMemo(
    () => (ready ? renderCurrent(DISPLAY_PX) : ''),
    [ready, renderCurrent],
  );

  // ── Walkthrough (3D 자동 카메라 순회) ──
  useEffect(() => {
    if (!walkthrough || mode !== '3d') return;
    const timer = setInterval(() => {
      setViewpoint((cur) => {
        const idx = VIEWPOINTS.findIndex((v) => v.id === cur);
        return VIEWPOINTS[(idx + 1) % VIEWPOINTS.length].id;
      });
    }, WALKTHROUGH_MS);
    return () => clearInterval(timer);
  }, [walkthrough, mode]);

  // ── 전체화면 ──
  const toggleFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // 카메라(← →) 이동: 3D=시점, 벽면=벽 전환
  const stepCamera = useCallback(
    (dir: 1 | -1) => {
      if (mode === '3d') {
        setViewpoint((cur) => {
          const idx = VIEWPOINTS.findIndex((v) => v.id === cur);
          return VIEWPOINTS[(idx + dir + VIEWPOINTS.length) % VIEWPOINTS.length].id;
        });
      } else if (mode === 'wall' && enabledWalls.length > 0) {
        setWallSide((cur) => {
          const idx = enabledWalls.indexOf(cur);
          return enabledWalls[(idx + dir + enabledWalls.length) % enabledWalls.length];
        });
      }
    },
    [mode, enabledWalls],
  );

  // ── 키보드 ──
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else onClose();
      } else if (e.key === 'ArrowRight') {
        stepCamera(1);
      } else if (e.key === 'ArrowLeft') {
        stepCamera(-1);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, stepCamera, toggleFullscreen]);

  // ── 스크린샷 ──
  const handleScreenshot = (res: keyof typeof SCREENSHOT_PX) => {
    setShotAnchor(null);
    const url = renderCurrent(SCREENSHOT_PX[res]);
    if (!url) {
      setToast('스크린샷을 생성할 수 없습니다.');
      return;
    }
    downloadDataURL(url, `${buildBaseName(brandLabel, layoutName)}_${mode}_${res}.png`);
  };

  // ── Presentation PDF ──
  const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const handlePdf = async () => {
    setBusy(true);
    try {
      const pages: { title: string; url: string }[] = [];
      const twoD = safe(() => render2D(2400, designOn));
      if (twoD) pages.push({ title: `${brandLabel} · ${layoutName} — 평면도`, url: twoD });
      if (heightSet) {
        const threeD = safe(() => render3D('frontDiagonal', 2400, designOn));
        if (threeD) pages.push({ title: `${brandLabel} · ${layoutName} — 3D 뷰`, url: threeD });
        for (const side of enabledWalls) {
          const w = safe(() => renderWall(side, 2200));
          if (w) pages.push({ title: `${brandLabel} · ${getViewModeLabel(side)}`, url: w });
        }
      }
      if (pages.length === 0) {
        setToast('PDF 를 생성할 수 없습니다.');
        return;
      }
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const PAGE_W = 297;
      const PAGE_H = 210;
      const PAD = 12;
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) pdf.addPage();
        const img = await loadImage(pages[i].url);
        pdf.setFontSize(14);
        pdf.setTextColor('#0f172a');
        pdf.text(pages[i].title, PAD, 16);
        const boxW = PAGE_W - PAD * 2;
        const boxH = PAGE_H - 24 - PAD;
        const ratio = img.width / img.height;
        let dw = boxW;
        let dh = boxW / ratio;
        if (dh > boxH) {
          dh = boxH;
          dw = boxH * ratio;
        }
        const dx = PAD + (boxW - dw) / 2;
        const dy = 22 + (boxH - dh) / 2;
        pdf.addImage(pages[i].url, 'PNG', dx, dy, dw, dh);
      }
      pdf.save(`${buildBaseName(brandLabel, layoutName)}_presentation.pdf`);
    } catch {
      setToast('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ── Presentation Share (읽기전용 링크 + ?present=1) ──
  const handleShare = async () => {
    if (!project) return;
    setBusy(true);
    try {
      const sid = project.shareId ?? generateId();
      await storage.saveProject({
        ...project,
        shareId: sid,
        shareEnabled: true,
        sharePermission: 'view',
        updatedAt: Date.now(),
      });
      const link = `${window.location.origin}/share/${sid}?present=1`;
      try {
        await navigator.clipboard.writeText(link);
        setToast('Presentation 링크를 복사했습니다 (읽기 전용).');
      } catch {
        setToast(link);
      }
    } catch {
      setToast('공유 링크 생성에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const bg = theme === 'dark' ? '#0b1220' : '#eef1f5';
  const fg = theme === 'dark' ? '#e2e8f0' : '#0f172a';
  const barBg = theme === 'dark' ? 'rgba(15,23,42,0.86)' : 'rgba(255,255,255,0.92)';

  const watermarkStyle = watermarkOn
    ? {
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='230'><text x='24' y='130' transform='rotate(-22 24 130)' fill='rgba(148,163,184,0.28)' font-size='26' font-weight='700' font-family='sans-serif'>${brandLabel}</text></svg>`,
        )}")`,
        backgroundRepeat: 'repeat',
      }
    : {};

  return (
    <Box
      ref={rootRef}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        bgcolor: bg,
        color: fg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 상단 바: 브랜드 + 네비게이션 + 닫기 */}
      <Stack
        direction="row"
        sx={{ alignItems: 'center', px: 2, py: 1, bgcolor: barBg, backdropFilter: 'blur(6px)', gap: 1 }}
      >
        {brandOn && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
            <BusinessRoundedIcon fontSize="small" color="primary" />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.1 }} noWrap>
                {brandLabel}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }} noWrap>
                {layoutName}
              </Typography>
            </Box>
          </Stack>
        )}

        <Box sx={{ flex: 1 }} />

        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_, v) => v && setMode(v)}
          color="primary"
        >
          <ToggleButton value="2d" sx={{ px: 2, color: fg }}>2D</ToggleButton>
          <ToggleButton value="3d" disabled={!heightSet} sx={{ px: 2, color: fg }}>3D</ToggleButton>
          <ToggleButton value="wall" disabled={!heightSet || enabledWalls.length === 0} sx={{ px: 2, color: fg }}>
            Wall
          </ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        <Tooltip title="종료 (ESC)">
          <IconButton onClick={onClose} sx={{ color: fg }}>
            <CloseRoundedIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* 메인 뷰 */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          ...watermarkStyle,
        }}
      >
        {!ready ? (
          <CircularProgress />
        ) : displayUrl ? (
          <Box
            component="img"
            src={displayUrl}
            alt="presentation"
            sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 1, boxShadow: theme === 'dark' ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(15,23,42,0.18)' }}
          />
        ) : (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            이 화면을 표시할 수 없습니다.
          </Typography>
        )}

        {/* 카메라 이동 (3D/벽면) */}
        {(mode === '3d' || mode === 'wall') && (
          <>
            <IconButton
              onClick={() => stepCamera(-1)}
              sx={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', bgcolor: barBg, color: fg }}
            >
              <ChevronLeftRoundedIcon />
            </IconButton>
            <IconButton
              onClick={() => stepCamera(1)}
              sx={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', bgcolor: barBg, color: fg }}
            >
              <ChevronRightRoundedIcon />
            </IconButton>
            <Typography
              variant="caption"
              sx={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', bgcolor: barBg, color: fg, px: 1.5, py: 0.5, borderRadius: 1, fontWeight: 700 }}
            >
              {mode === '3d'
                ? VIEWPOINTS.find((v) => v.id === viewpoint)?.label
                : getViewModeLabel(wallSide)}
            </Typography>
          </>
        )}
      </Box>

      {/* 하단 컨트롤 바 */}
      <Stack
        direction="row"
        sx={{ alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 0.5, px: 2, py: 1, bgcolor: barBg, backdropFilter: 'blur(6px)' }}
      >
        <Tooltip title={designOn ? '디자인 표시 중 (클릭 시 숨김)' : '디자인 숨김 (클릭 시 표시)'}>
          <Button
            size="small"
            variant={designOn ? 'contained' : 'outlined'}
            startIcon={<PaletteRoundedIcon />}
            onClick={() => setDesignOn((v) => !v)}
            sx={{ color: designOn ? undefined : fg, borderColor: fg }}
          >
            디자인 {designOn ? 'ON' : 'OFF'}
          </Button>
        </Tooltip>

        <Tooltip title="배경 밝게/어둡게">
          <IconButton size="small" onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} sx={{ color: fg }}>
            {theme === 'light' ? <DarkModeRoundedIcon fontSize="small" /> : <LightModeRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {mode === '3d' && (
          <Tooltip title={walkthrough ? 'Walkthrough 정지' : 'Walkthrough 자동 재생'}>
            <IconButton size="small" onClick={() => setWalkthrough((v) => !v)} sx={{ color: fg }}>
              {walkthrough ? <PauseRoundedIcon fontSize="small" /> : <PlayArrowRoundedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(148,163,184,0.4)' }} />

        <Tooltip title={brandOn ? '로고 숨김' : '로고 표시'}>
          <IconButton
            size="small"
            onClick={() => setBrandOn((v) => !v)}
            sx={{ color: fg, opacity: brandOn ? 1 : 0.5 }}
          >
            <BusinessRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={watermarkOn ? '워터마크 끄기' : '워터마크 켜기'}>
          <IconButton
            size="small"
            onClick={() => setWatermarkOn((v) => !v)}
            sx={{ color: fg, opacity: watermarkOn ? 1 : 0.5 }}
          >
            <BrandingWatermarkRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5, borderColor: 'rgba(148,163,184,0.4)' }} />

        <Tooltip title="스크린샷 저장">
          <span>
            <IconButton size="small" onClick={(e) => setShotAnchor(e.currentTarget)} sx={{ color: fg }} disabled={busy}>
              <PhotoCameraRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Menu anchorEl={shotAnchor} open={shotAnchor !== null} onClose={() => setShotAnchor(null)}>
          {(Object.keys(SCREENSHOT_PX) as (keyof typeof SCREENSHOT_PX)[]).map((r) => (
            <MenuItem key={r} onClick={() => handleScreenshot(r)}>
              {r} ({SCREENSHOT_PX[r]}px)
            </MenuItem>
          ))}
        </Menu>

        <Tooltip title="시안 검토용 PDF">
          <span>
            <IconButton size="small" onClick={handlePdf} sx={{ color: fg }} disabled={busy}>
              <PictureAsPdfRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Presentation 공유 링크 (읽기 전용)">
          <span>
            <IconButton size="small" onClick={handleShare} sx={{ color: fg }} disabled={busy || !project}>
              <ShareRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="전체화면 (F)">
          <IconButton size="small" onClick={toggleFullscreen} sx={{ color: fg }}>
            {isFullscreen ? <FullscreenExitRoundedIcon fontSize="small" /> : <FullscreenRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        {busy && <CircularProgress size={18} sx={{ ml: 1 }} />}
      </Stack>

      <Snackbar
        open={toast !== null}
        autoHideDuration={2600}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      />
    </Box>
  );
}

/** 렌더가 throw 해도(예: 이미지 taint) 앱이 죽지 않도록 감싸는 헬퍼 */
function safe(fn: () => string): string {
  try {
    return fn();
  } catch {
    return '';
  }
}

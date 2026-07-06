import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WallSide } from '../../types';
import { useEditor } from './EditorContext';
import BoothCanvas from '../canvas/BoothCanvas';
import EditorToolbar from './EditorToolbar';
import WallCanvas from '../wall/WallCanvas';
import PresentationMode from '../presentation/PresentationMode';
import { getBoothSizeLabel, getFloorLabel, hasBoothHeight } from '../../constants/booth';
import {
  VIEW_MODE_OPTIONS,
  WALL_SIDES,
  isWallView,
  isWallEnabled,
  getViewModeLabel,
  getWallLengthMm,
  type ViewMode,
} from '../wall/constants';

/**
 * 편집기 중앙 영역: 보기 탭 + 프로젝트 요약 + 캔버스(평면/벽면).
 */
export default function EditorCanvasArea() {
  const navigate = useNavigate();
  const {
    project,
    projectLoading,
    placed,
    texts,
    dimensions,
    planImages,
    planBackgrounds,
    designAssets,
    fixturesById,
    selectedFixtureId,
    selectedTextId,
    selectedDimensionId,
    selectedImageId,
    selectedBackgroundId,
    showFixtureNames,
    gridSizeMm,
    select,
    move,
    selectText,
    moveText,
    selectDimension,
    moveDimension,
    selectImage,
    updatePlanImage,
    selectBackground,
    updatePlanBackground,
    selectedSvgDocument,
    selectedSvgElementId,
    viewRotationDeg,
    canEdit,
    shapeEditMode,
    setShapeEditMode,
    updateBoothShape,
    viewMode,
    setViewMode,
    wallItems,
    selectedItem,
    selectWallText,
    moveWallText,
    selectWallDimension,
    moveWallDimension,
    selectWallImage,
    updateWallImage,
    clearSelection,
    setWallEnabled,
  } = useEditor();

  const [wallMenuAnchor, setWallMenuAnchor] = useState<null | HTMLElement>(null);
  const [presentationOpen, setPresentationOpen] = useState(false);

  // 공유 Presentation 링크(?present=1)로 진입 시 프로젝트 로드 후 자동 열기
  useEffect(() => {
    if (!project) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('present') === '1') setPresentationOpen(true);
  }, [project]);

  if (projectLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>프로젝트를 찾을 수 없습니다</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          삭제되었거나 잘못된 주소일 수 있습니다.
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/projects')}>프로젝트 목록으로</Button>
      </Box>
    );
  }

  const { boothConfig } = project;
  const heightSet = hasBoothHeight(boothConfig);
  // 높이 미설정 또는 현재 벽면이 OFF 이면 벽면 보기 불가 → 강제 평면도
  const currentWallOff =
    isWallView(viewMode) && !isWallEnabled(boothConfig, viewMode as WallSide);
  const effectiveMode: ViewMode =
    isWallView(viewMode) && (!heightSet || currentWallOff) ? 'plan' : viewMode;
  const wallView = isWallView(effectiveMode);
  const wallLengthMm = getWallLengthMm(boothConfig, effectiveMode);
  const currentWall = wallView ? (effectiveMode as Exclude<ViewMode, 'plan'>) : null;
  const wallGroup = currentWall ? wallItems[currentWall] : { texts: [], dimensions: [], images: [] };
  const wallSel = (type: 'text' | 'dimension' | 'image') =>
    selectedItem?.scope === 'wall' && selectedItem.wall === currentWall && selectedItem.type === type
      ? selectedItem.id
      : null;

  return (
    <>
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 보기 모드 탭 (높이 미설정/OFF 벽면 비활성) + 사용할 벽면 설정 */}
      <Stack
        direction="row"
        sx={{ alignItems: 'center', mb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <Tabs
          value={effectiveMode}
          onChange={(_, v) => setViewMode(v as ViewMode)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ minHeight: 40, flex: 1 }}
        >
          {VIEW_MODE_OPTIONS.map((opt) => (
            <Tab
              key={opt.value}
              value={opt.value}
              label={opt.label}
              disabled={
                opt.value !== 'plan' &&
                (!heightSet || !isWallEnabled(boothConfig, opt.value as WallSide))
              }
              sx={{ minHeight: 40, py: 0 }}
            />
          ))}
        </Tabs>
        <Tooltip title="사용할 벽면 설정">
          <IconButton size="small" onClick={(e) => setWallMenuAnchor(e.currentTarget)} sx={{ ml: 0.5 }}>
            <ViewSidebarRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={wallMenuAnchor} open={wallMenuAnchor !== null} onClose={() => setWallMenuAnchor(null)}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
            사용할 벽면 (OFF 시 탭·출력·3D 제외)
          </Typography>
          {WALL_SIDES.map((side) => (
            <MenuItem key={side} dense disableRipple sx={{ py: 0 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={isWallEnabled(boothConfig, side)}
                    onChange={(e) => setWallEnabled(side, e.target.checked)}
                  />
                }
                label={getViewModeLabel(side)}
                sx={{ m: 0 }}
              />
            </MenuItem>
          ))}
        </Menu>
      </Stack>

      {wallView ? (
        <>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {getViewModeLabel(effectiveMode)} · {wallLengthMm} × {boothConfig.heightMm} mm
            </Typography>
          </Paper>

          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary', mb: 1, px: 0.5 }}>
            <KeyboardRoundedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">벽면에 텍스트·치수선·이미지 추가 · Delete 삭제 · R 회전 · Ctrl+D 복사 · 방향키 이동</Typography>
          </Stack>

          <EditorToolbar onOpenPresentation={() => setPresentationOpen(true)} />

          <Box sx={{ flex: 1, minHeight: 320 }}>
            <WallCanvas
              wallLengthMm={wallLengthMm}
              heightMm={boothConfig.heightMm ?? 0}
              gridSizeMm={gridSizeMm}
              texts={wallGroup.texts}
              dimensions={wallGroup.dimensions}
              images={wallGroup.images}
              selectedTextId={wallSel('text')}
              selectedDimensionId={wallSel('dimension')}
              selectedImageId={wallSel('image')}
              onSelectText={(id) => currentWall && selectWallText(currentWall, id)}
              onMoveText={(id, x, y) => currentWall && moveWallText(currentWall, id, x, y)}
              onSelectDimension={(id) => currentWall && selectWallDimension(currentWall, id)}
              onMoveDimension={(id, dx, dy) => currentWall && moveWallDimension(currentWall, id, dx, dy)}
              onSelectImage={(id) => currentWall && selectWallImage(currentWall, id)}
              onChangeImage={(id, patch) => currentWall && updateWallImage(currentWall, id, patch)}
              onDeselect={clearSelection}
            />
          </Box>
        </>
      ) : (
        <>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>{project.name}</Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Chip label={`치수 ${getBoothSizeLabel(boothConfig)}`} />
              <Chip variant="outlined" label={`오픈 ${boothConfig.openSide}면`} />
              <Chip variant="outlined" label={`바닥 ${getFloorLabel(boothConfig)}`} />
            </Stack>
            {!heightSet && (
              <Alert severity="info" sx={{ mt: 1.5 }}>
                부스 높이를 설정해야 벽면 전개도와 3D 미리보기를 사용할 수 있습니다.
              </Alert>
            )}
          </Paper>

          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', color: 'text.secondary', mb: 1, px: 0.5 }}>
            <KeyboardRoundedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              Delete 삭제 · R 회전 · Ctrl+D 복사 · 방향키 이동(100mm) · Shift+방향키 500mm · Shift 드래그: 스마트 스냅
            </Typography>
          </Stack>

          <EditorToolbar onOpenPresentation={() => setPresentationOpen(true)} />

          <Box sx={{ flex: 1, minHeight: 320 }}>
            <BoothCanvas
              booth={boothConfig}
              placed={placed}
              texts={texts}
              dimensions={dimensions}
              images={planImages}
              backgrounds={planBackgrounds}
              fixturesById={fixturesById}
              showFixtureNames={showFixtureNames}
              designAssets={designAssets}
              selectedFixtureId={selectedFixtureId}
              selectedTextId={selectedTextId}
              selectedDimensionId={selectedDimensionId}
              selectedImageId={selectedImageId}
              selectedBackgroundId={selectedBackgroundId}
              selectedSvgDoc={selectedSvgDocument}
              highlightedSvgElementId={selectedSvgElementId}
              viewRotationDeg={viewRotationDeg}
              interactive={canEdit}
              shapeEditMode={shapeEditMode}
              onBoothShapeChange={updateBoothShape}
              onExitShapeEdit={() => setShapeEditMode(false)}
              gridSizeMm={gridSizeMm}
              onSelect={select}
              onMove={move}
              onSelectText={selectText}
              onMoveText={moveText}
              onSelectDimension={selectDimension}
              onMoveDimension={moveDimension}
              onSelectImage={selectImage}
              onChangeImage={updatePlanImage}
              onSelectBackground={selectBackground}
              onChangeBackground={updatePlanBackground}
            />
          </Box>
        </>
      )}
    </Box>
    <PresentationMode open={presentationOpen} onClose={() => setPresentationOpen(false)} />
    </>
  );
}

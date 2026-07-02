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
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import { useNavigate } from 'react-router-dom';
import { useEditor } from './EditorContext';
import BoothCanvas from '../canvas/BoothCanvas';
import EditorToolbar from './EditorToolbar';
import WallCanvas from '../wall/WallCanvas';
import { getBoothSizeLabel, getFloorLabel, hasBoothHeight } from '../../constants/booth';
import {
  VIEW_MODE_OPTIONS,
  isWallView,
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
  } = useEditor();

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
  // 높이 미설정이면 벽면 보기 불가 → 강제 평면도
  const effectiveMode: ViewMode = !heightSet && isWallView(viewMode) ? 'plan' : viewMode;
  const wallView = isWallView(effectiveMode);
  const wallLengthMm = getWallLengthMm(boothConfig, effectiveMode);
  const currentWall = wallView ? (effectiveMode as Exclude<ViewMode, 'plan'>) : null;
  const wallGroup = currentWall ? wallItems[currentWall] : { texts: [], dimensions: [], images: [] };
  const wallSel = (type: 'text' | 'dimension' | 'image') =>
    selectedItem?.scope === 'wall' && selectedItem.wall === currentWall && selectedItem.type === type
      ? selectedItem.id
      : null;

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 보기 모드 탭 (높이 미설정 시 벽면 탭 비활성) */}
      <Tabs
        value={effectiveMode}
        onChange={(_, v) => setViewMode(v as ViewMode)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ minHeight: 40, mb: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        {VIEW_MODE_OPTIONS.map((opt) => (
          <Tab
            key={opt.value}
            value={opt.value}
            label={opt.label}
            disabled={opt.value !== 'plan' && !heightSet}
            sx={{ minHeight: 40, py: 0 }}
          />
        ))}
      </Tabs>

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

          <EditorToolbar />

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

          <EditorToolbar />

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
              selectedFixtureId={selectedFixtureId}
              selectedTextId={selectedTextId}
              selectedDimensionId={selectedDimensionId}
              selectedImageId={selectedImageId}
              selectedBackgroundId={selectedBackgroundId}
              selectedSvgDoc={selectedSvgDocument}
              highlightedSvgElementId={selectedSvgElementId}
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
  );
}

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
import { useState, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WallSide } from '../../types';
import { useEditor } from './EditorContext';
import BoothCanvas from '../canvas/BoothCanvas';
import EditorToolbar from './EditorToolbar';
import WallCanvas from '../wall/WallCanvas';
import PrintWorkspace from '../print/PrintWorkspace';
import MerchandisingWorkspace from '../products/MerchandisingWorkspace';
import MultiActionToolbar from '../tools/MultiActionToolbar';
import IsoPreviewDialog from '../iso/IsoPreviewDialog';
import CommandPalette, { type Command } from './CommandPalette';
import SettingsDialog from './SettingsDialog';
import EditorStatusBar from './EditorStatusBar';
import ResizableSplit from './ResizableSplit';
import BoothSizeFields from './BoothSizeFields';
import { useEffect, useMemo } from 'react';
import { detectCollisions, productById as findProduct } from '../products/productModel';
import { downloadLayoutPNG, downloadLayoutPDF, type ExportInput } from '../export/exportLayout';
import { getFloorLabel, hasBoothHeight } from '../../constants/booth';
import {
  VIEW_MODE_OPTIONS,
  WALL_SIDES,
  isWallView,
  isWallEnabled,
  getViewModeLabel,
  getWallLengthMm,
  getWallColor,
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
    products,
    placedProducts,
    selectedProductId,
    selectProduct,
    moveProduct,
    fixturesById,
    selectedFixtureId,
    selectedFixtureIds,
    selectedTextId,
    selectedDimensionId,
    selectedImageId,
    selectedBackgroundId,
    showFixtureNames,
    showDimensions,
    gridSizeMm,
    select,
    move,
    moveFixtures,
    selectMany,
    rotateFixtureTo,
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
    setWallColor,
    // v0.9.5 명령/상태
    undo,
    redo,
    canUndo,
    canRedo,
    rotateSelected,
    copySelected,
    deleteSelected,
    addText,
    addDimension,
    alignFixtures,
    layouts,
    currentLayoutId,
  } = useEditor();

  const [wallMenuAnchor, setWallMenuAnchor] = useState<null | HTMLElement>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [isoOpen, setIsoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Ctrl/Cmd+K → Command Palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const [merchOpen, setMerchOpen] = useState(false);

  // 제품 충돌 검출 (v0.9.3)
  const collidedProductIds = useMemo(
    () => detectCollisions(placedProducts, (id) => findProduct(products, id)),
    [placedProducts, products],
  );

  // 내보내기 (Command Palette 용)
  const runExport = async (kind: 'png' | 'pdf') => {
    if (!project) return;
    const cl = layouts.find((l) => l.id === currentLayoutId);
    const now = Date.now();
    const input: ExportInput = {
      project,
      layoutName: cl?.name ?? '미저장',
      createdAt: cl?.createdAt ?? now,
      updatedAt: cl?.updatedAt ?? now,
      placed,
      texts,
      dimensions,
      images: planImages,
      backgrounds: planBackgrounds,
      showFixtureNames,
      fixturesById,
      viewRotationDeg,
      designAssets,
      placedProducts,
      products,
    };
    if (kind === 'png') await downloadLayoutPNG(input);
    else await downloadLayoutPDF(input);
  };

  // Command Palette 명령 목록 (v0.9.5)
  const commands: Command[] = [
    { id: 'undo', label: '실행 취소 (Undo)', group: '편집', shortcut: 'Ctrl+Z', keywords: 'undo', disabled: !canUndo, run: undo },
    { id: 'redo', label: '다시 실행 (Redo)', group: '편집', shortcut: 'Ctrl+Y', keywords: 'redo', disabled: !canRedo, run: redo },
    { id: 'rotate', label: '90° 회전', group: '편집', shortcut: 'R', keywords: 'rotate', disabled: !selectedItem, run: rotateSelected },
    { id: 'dup', label: '복사/복제', group: '편집', shortcut: 'Ctrl+D', keywords: 'duplicate copy', disabled: !selectedItem, run: copySelected },
    { id: 'del', label: '삭제', group: '편집', shortcut: 'Delete', keywords: 'delete remove', disabled: !selectedItem, run: deleteSelected },
    { id: 'alignL', label: '왼쪽 정렬', group: '정렬', keywords: 'align left', disabled: selectedFixtureIds.length < 2, run: () => alignFixtures('left') },
    { id: 'alignR', label: '오른쪽 정렬', group: '정렬', keywords: 'align right', disabled: selectedFixtureIds.length < 2, run: () => alignFixtures('right') },
    { id: 'alignCH', label: '가로 중앙 정렬', group: '정렬', keywords: 'align center', disabled: selectedFixtureIds.length < 2, run: () => alignFixtures('centerH') },
    { id: 'alignCV', label: '세로 중앙 정렬', group: '정렬', keywords: 'align middle', disabled: selectedFixtureIds.length < 2, run: () => alignFixtures('centerV') },
    // 분배/미러 커맨드는 v1.0.8 에서 UI 숨김(EditorContext 함수는 유지)
    { id: 'addText', label: '텍스트 추가', group: '추가', keywords: 'text add', disabled: !canEdit, run: addText },
    { id: 'addDim', label: '치수선 추가', group: '추가', keywords: 'dimension', disabled: !canEdit, run: addDimension },
    { id: '3d', label: '3D 미리보기 열기', group: '보기', keywords: '3d preview iso lighting', run: () => setIsoOpen(true) },
    // 출력물 제작 커맨드는 v1.0.7 에서 숨김(기능/코드 유지)
    { id: 'merch', label: '진열 관리 열기', group: '보기', keywords: 'merchandising display guide', run: () => setMerchOpen(true) },
    { id: 'settings', label: '설정 열기', group: '보기', keywords: 'settings grid snap', run: () => setSettingsOpen(true) },
    { id: 'expPng', label: 'PNG 내보내기', group: '내보내기', keywords: 'export png image', run: () => void runExport('png') },
    { id: 'expPdf', label: 'PDF 내보내기', group: '내보내기', keywords: 'export pdf', run: () => void runExport('pdf') },
  ];

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
          onChange={(_, v) => {
            // 'vmd' 탭은 별도 2D VMD 워크스페이스로 이동(동일 프로젝트, 데이터 충돌 없음)
            if (v === 'vmd') {
              navigate(`/projects/${project.id}/vmd`);
              return;
            }
            setViewMode(v as ViewMode);
          }}
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
          {/* VMD 시안 탭 (§2, v1.0.2) — 평면도·벽면과 같은 줄에 배치 */}
          <Tab value="vmd" label="VMD 시안" sx={{ minHeight: 40, py: 0, fontWeight: 700 }} />
        </Tabs>
        <Tooltip title="사용할 벽면 설정">
          <IconButton size="small" onClick={(e) => setWallMenuAnchor(e.currentTarget)} sx={{ ml: 0.5 }}>
            <ViewSidebarRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={wallMenuAnchor} open={wallMenuAnchor !== null} onClose={() => setWallMenuAnchor(null)}>
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 0.5, display: 'block' }}>
            사용할 벽면 (OFF 시 탭·출력·3D 제외) · 벽 색상
          </Typography>
          {WALL_SIDES.map((side) => {
            const enabled = isWallEnabled(boothConfig, side);
            const color = getWallColor(boothConfig, side);
            return (
              <MenuItem key={side} dense disableRipple sx={{ py: 0.25, gap: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={enabled}
                      onChange={(e) => setWallEnabled(side, e.target.checked)}
                    />
                  }
                  label={getViewModeLabel(side)}
                  sx={{ m: 0, flex: 1 }}
                />
                {/* 벽 색상: 존재(ON)하는 벽만 노출 (v1.1.7) */}
                {enabled && (
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Box
                      component="input"
                      type="color"
                      aria-label={`${getViewModeLabel(side)} 색상`}
                      value={color ?? '#c3ccd8'}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setWallColor(side, e.target.value)}
                      sx={{
                        width: 26,
                        height: 22,
                        p: 0,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 0.75,
                        bgcolor: 'transparent',
                        cursor: 'pointer',
                      }}
                    />
                    <Button
                      size="small"
                      onClick={() => setWallColor(side, undefined)}
                      disabled={!color}
                      sx={{ minWidth: 0, px: 0.75, fontSize: 11 }}
                    >
                      기본
                    </Button>
                  </Stack>
                )}
              </MenuItem>
            );
          })}
        </Menu>
      </Stack>

      {wallView ? (
        <ResizableSplit
          storageKey="blp:centerTopH:wall"
          topSlot={
            <>
              {/* 툴바를 상단에 배치 → 높이를 줄여도 툴바는 항상 보임 (v1.2.1) */}
              <EditorToolbar
                onOpenPrint={() => setPrintOpen(true)}
                onOpenMerchandising={() => setMerchOpen(true)}
                onOpen3D={() => setIsoOpen(true)}
                onOpenSettings={() => setSettingsOpen(true)}
                onOpenPalette={() => setPaletteOpen(true)}
              />
              <Paper elevation={0} sx={{ p: 1, border: '1px solid', borderColor: 'divider', mt: 1 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                    {getViewModeLabel(effectiveMode)}
                  </Typography>
                  <Chip size="small" variant="outlined" label={`${wallLengthMm} × ${boothConfig.heightMm} mm`} />
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary' }}>
                    <KeyboardRoundedIcon sx={{ fontSize: 15 }} />
                    <Typography variant="caption">텍스트·치수선·이미지 추가 · Delete · R · Ctrl+D · 방향키</Typography>
                  </Stack>
                </Stack>
              </Paper>
            </>
          }
          canvasSlot={
            <WallCanvas
              wallLengthMm={wallLengthMm}
              heightMm={boothConfig.heightMm ?? 0}
              wallColor={currentWall ? getWallColor(boothConfig, currentWall) : undefined}
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
          }
        />
      ) : (
        <>
          <ResizableSplit
            storageKey="blp:centerTopH:plan"
            topSlot={
              <>
                {/* 툴바를 상단에 배치 → 높이를 줄여도 툴바는 항상 보임 (v1.2.1) */}
                <EditorToolbar
                  onOpenPrint={() => setPrintOpen(true)}
                  onOpenMerchandising={() => setMerchOpen(true)}
                  onOpen3D={() => setIsoOpen(true)}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onOpenPalette={() => setPaletteOpen(true)}
                />
                {/* 컴팩트 정보 바 — 부스명 + 부스 크기 직접 입력 + 오픈/바닥 */}
                <Paper elevation={0} sx={{ p: 1, border: '1px solid', borderColor: 'divider', mt: 1 }}>
                  <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, maxWidth: 220 }} noWrap>{project.name}</Typography>
                    <BoothSizeFields />
                    <Chip size="small" variant="outlined" label={`오픈 ${boothConfig.openSide}면`} />
                    <Chip size="small" variant="outlined" label={`바닥 ${getFloorLabel(boothConfig)}`} />
                  </Stack>
                  {!heightSet && (
                    <Alert severity="info" sx={{ mt: 1, py: 0 }}>
                      부스 높이를 설정해야 벽면 전개도와 3D 미리보기를 사용할 수 있습니다.
                    </Alert>
                  )}
                </Paper>
              </>
            }
            canvasSlot={
              <>
                <MultiActionToolbar />
                <BoothCanvas
                  booth={boothConfig}
                  placed={placed}
                  texts={texts}
                  dimensions={dimensions}
                  images={planImages}
                  backgrounds={planBackgrounds}
                  fixturesById={fixturesById}
                  showFixtureNames={showFixtureNames}
                  showDimensions={showDimensions}
                  designAssets={designAssets}
                  placedProducts={placedProducts}
                  products={products}
                  selectedProductId={selectedProductId}
                  collidedProductIds={collidedProductIds}
                  onSelectProduct={selectProduct}
                  onMoveProduct={moveProduct}
                  selectedFixtureId={selectedFixtureId}
                  selectedFixtureIds={selectedFixtureIds}
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
                  onMoveFixtures={moveFixtures}
                  onSelectMany={selectMany}
                  onRotateFixture={rotateFixtureTo}
                  onSelectText={selectText}
                  onMoveText={moveText}
                  onSelectDimension={selectDimension}
                  onMoveDimension={moveDimension}
                  onSelectImage={selectImage}
                  onChangeImage={updatePlanImage}
                  onSelectBackground={selectBackground}
                  onChangeBackground={updatePlanBackground}
                  onZoomChange={setZoom}
                />
              </>
            }
          />
          <EditorStatusBar zoom={zoom} />
        </>
      )}
    </Box>
    <PrintWorkspace
      open={printOpen}
      onClose={() => setPrintOpen(false)}
      initialFixtureId={selectedFixtureId}
    />
    <MerchandisingWorkspace open={merchOpen} onClose={() => setMerchOpen(false)} />
    <IsoPreviewDialog open={isoOpen} onClose={() => setIsoOpen(false)} />
    <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
    </>
  );
}

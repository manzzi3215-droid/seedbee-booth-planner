import { useRef, useState } from 'react';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SaveAsRoundedIcon from '@mui/icons-material/SaveAsRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import TextFieldsRoundedIcon from '@mui/icons-material/TextFieldsRounded';
import StraightenRoundedIcon from '@mui/icons-material/StraightenRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import RotateLeftRoundedIcon from '@mui/icons-material/RotateLeftRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import PolylineRoundedIcon from '@mui/icons-material/PolylineRounded';
import { getBoothPolygon, polygonAreaMm2 } from '../canvas/boothGeometry';
import { isFixtureOutOfBounds } from '../canvas/fixtureGeometry';
import DriveFileRenameOutlineRoundedIcon from '@mui/icons-material/DriveFileRenameOutlineRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import IsoPreviewDialog from '../iso/IsoPreviewDialog';
import { useEditor } from './EditorContext';
import { parseSvgDocument } from '../svg/SvgParser';
import {
  downloadLayoutPNG,
  downloadLayoutPDF,
  downloadWallPNG,
  downloadWallPDF,
  type ExportInput,
  type WallExportInput,
} from '../export/exportLayout';
import { computeFixtureUsage } from '../export/fixtureUsage';
import FixtureUsageDialog from '../export/FixtureUsageDialog';
import { isWallView, getViewModeLabel, getWallLengthMm } from '../wall/constants';
import { hasBoothHeight } from '../../constants/booth';

/**
 * 편집기 상단 저장 툴바.
 *  - [배치안 선택]: 저장된 배치안 불러오기 (미저장 변경 시 confirm)
 *  - [저장]: 현재 배치안에 저장 (없으면 v1 자동 생성)
 *  - [다른 이름으로 저장]: 새 배치안으로 저장
 */
export default function EditorToolbar() {
  const {
    project,
    placed,
    texts,
    dimensions,
    planImages,
    planBackgrounds,
    fixturesById,
    showFixtureNames,
    setShowFixtureNames,
    addBackground,
    svgDocuments,
    addSvgDocument,
    selectSvgDocument,
    layouts,
    currentLayoutId,
    dirty,
    saveStatus,
    isCloud,
    saveCurrent,
    saveAs,
    loadLayout,
    suggestLayoutName,
    renameLayout,
    duplicateLayout,
    deleteLayoutById,
    addText,
    addDimension,
    addImage,
    viewMode,
    wallItems,
    readOnly,
    canEdit,
    viewRotationDeg,
    setViewRotationDeg,
    shapeEditMode,
    setShapeEditMode,
  } = useEditor();

  // 부스 넓이(m²) + 외곽 밖 집기 경고 (실시간)
  const boothAreaM2 = project ? polygonAreaMm2(getBoothPolygon(project.boothConfig)) / 1_000_000 : 0;
  const oobCount = project
    ? placed.filter((p) => {
        const def = fixturesById.get(p.fixtureDefId);
        return def ? isFixtureOutOfBounds(p, def, getBoothPolygon(project.boothConfig)) : false;
      }).length
    : 0;

  const [rotStr, setRotStr] = useState('');
  const rotateViewBy = (delta: number) =>
    setViewRotationDeg((((viewRotationDeg + delta) % 360) + 360) % 360);
  const applyRotInput = () => {
    const v = Number(rotStr);
    if (!Number.isNaN(v)) setViewRotationDeg(((Math.round(v) % 360) + 360) % 360);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [usageOpen, setUsageOpen] = useState(false);
  const [isoOpen, setIsoOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [svgImport, setSvgImport] = useState<{ text: string; name: string; dataUrl: string } | null>(null);
  const [svgMenuAnchor, setSvgMenuAnchor] = useState<null | HTMLElement>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<null | HTMLElement>(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

  const currentLayout = layouts.find((l) => l.id === currentLayoutId) ?? null;

  /** 현재 화면(placed) 기준 export 입력 구성 */
  const buildExportInput = (): ExportInput | null => {
    if (!project) return null;
    const now = Date.now();
    return {
      project,
      layoutName: currentLayout?.name ?? '미저장',
      createdAt: currentLayout?.createdAt ?? now,
      updatedAt: currentLayout?.updatedAt ?? now,
      placed,
      texts,
      dimensions,
      images: planImages,
      backgrounds: planBackgrounds,
      showFixtureNames,
      fixturesById,
      viewRotationDeg,
    };
  };

  /** 미저장 상태면 confirm. 취소 시 false */
  const confirmIfDirty = (): boolean => {
    if (!dirty) return true;
    return window.confirm(
      '저장되지 않은 변경사항이 있습니다. 현재 화면 기준으로 출력할까요?',
    );
  };

  /** 벽면 export 입력 구성 (현재 벽면 기준) */
  const buildWallExportInput = (): WallExportInput | null => {
    if (!project || viewMode === 'plan') return null;
    const wall = viewMode;
    const now = Date.now();
    return {
      project,
      layoutName: currentLayout?.name ?? '미저장',
      createdAt: currentLayout?.createdAt ?? now,
      updatedAt: currentLayout?.updatedAt ?? now,
      wall,
      wallLabel: getViewModeLabel(wall),
      wallLengthMm: getWallLengthMm(project.boothConfig, wall),
      heightMm: project.boothConfig.heightMm ?? 0,
      texts: wallItems[wall].texts,
      dimensions: wallItems[wall].dimensions,
      images: wallItems[wall].images,
    };
  };

  const handleExportPNG = async () => {
    if (!confirmIfDirty()) return;
    setExporting(true);
    try {
      if (isWallView(viewMode)) {
        const wi = buildWallExportInput();
        if (wi) await downloadWallPNG(wi);
      } else {
        const input = buildExportInput();
        if (input) await downloadLayoutPNG(input);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!confirmIfDirty()) return;
    setExporting(true);
    try {
      if (isWallView(viewMode)) {
        const wi = buildWallExportInput();
        if (wi) await downloadWallPDF(wi);
      } else {
        const input = buildExportInput();
        if (input) await downloadLayoutPDF(input);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleSelect = (e: SelectChangeEvent) => {
    const id = e.target.value;
    if (!id || id === currentLayoutId) return;
    if (
      dirty &&
      !window.confirm(
        '현재 배치가 저장되지 않았을 수 있습니다.\n다른 배치안을 불러오면 저장하지 않은 변경사항이 사라집니다. 계속할까요?',
      )
    ) {
      return;
    }
    loadLayout(id);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCurrent();
      setToast('저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const aspect = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
        addImage({
          name: file.name.replace(/\.[^.]+$/, ''),
          srcDataUrl: dataUrl,
          widthMm: 1000,
          heightMm: Math.max(1, Math.round(1000 * aspect)),
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  /** SVG 텍스트 → dataURL (미리보기/렌더용) */
  const svgTextToDataUrl = (text: string) =>
    `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;

  // SVG 파일 선택 → 가져오기 방식 선택 다이얼로그 오픈
  const handleSvgFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !project) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setSvgImport({
        text,
        name: file.name.replace(/\.[^.]+$/, ''),
        dataUrl: svgTextToDataUrl(text),
      });
    };
    reader.readAsText(file);
  };

  // ① 배경으로 가져오기 (기존 동작)
  const importAsBackground = () => {
    if (!svgImport || !project) return;
    const booth = project.boothConfig;
    const widthMm = booth.widthMm;
    const { name, dataUrl } = svgImport;
    const img = new window.Image();
    img.onload = () => {
      const aspect = img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : booth.depthMm / booth.widthMm;
      addBackground({ name, srcDataUrl: dataUrl, widthMm, heightMm: Math.max(1, Math.round(widthMm * aspect)) });
    };
    img.onerror = () => addBackground({ name, srcDataUrl: dataUrl, widthMm, heightMm: booth.depthMm });
    img.src = dataUrl;
    setSvgImport(null);
    setToast('SVG를 배경으로 가져왔습니다.');
  };

  // ② SVG 객체로 가져오기 (구조 파싱 → SvgDocument)
  const importAsObject = () => {
    if (!svgImport || !project) return;
    const booth = project.boothConfig;
    try {
      const doc = parseSvgDocument(svgImport.text, svgImport.name, svgImport.dataUrl, {
        xMm: 0,
        yMm: 0,
        widthMm: booth.widthMm,
        heightMm: booth.depthMm,
      });
      const aspect = doc.viewBox.width > 0 ? doc.viewBox.height / doc.viewBox.width : booth.depthMm / booth.widthMm;
      doc.widthMm = booth.widthMm;
      doc.heightMm = Math.max(1, Math.round(booth.widthMm * aspect));
      addSvgDocument(doc);
      setToast(`SVG 객체로 가져왔습니다. (도형 ${doc.elements.length}개)`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : 'SVG 파싱에 실패했습니다.');
    }
    setSvgImport(null);
  };

  const openSaveAs = () => {
    setNewName(suggestLayoutName());
    setDialogOpen(true);
  };

  const handleSaveAs = async () => {
    setSaving(true);
    try {
      await saveAs(newName);
      setDialogOpen(false);
      setToast('새 배치안으로 저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  // ── 배치안 관리 (이름 변경 / 복제 / 삭제) ──
  const openRename = () => {
    setMenuAnchor(null);
    if (!currentLayout) return;
    setRenameName(currentLayout.name);
    setRenameOpen(true);
  };

  const handleRename = async () => {
    if (!currentLayout) return;
    setSaving(true);
    try {
      await renameLayout(currentLayout.id, renameName);
      setRenameOpen(false);
      setToast('배치안 이름이 변경되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    setMenuAnchor(null);
    if (!currentLayout) return;
    setSaving(true);
    try {
      await duplicateLayout(currentLayout.id);
      setToast('배치안이 복제되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setMenuAnchor(null);
    if (!currentLayout) return;
    if (!window.confirm(`'${currentLayout.name}' 배치안을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setSaving(true);
    try {
      await deleteLayoutById(currentLayout.id);
      setToast('배치안이 삭제되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 1,
        mb: 1,
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          배치안
        </Typography>
        <Select
          size="small"
          value={currentLayoutId ?? ''}
          displayEmpty
          onChange={handleSelect}
          sx={{ minWidth: 150 }}
          renderValue={(val) =>
            val
              ? layouts.find((l) => l.id === val)?.name ?? ''
              : <Box component="em" sx={{ color: 'text.disabled' }}>저장된 배치안 없음</Box>
          }
        >
          {layouts.length === 0 && (
            <MenuItem value="" disabled>
              저장된 배치안 없음
            </MenuItem>
          )}
          {layouts.map((l) => (
            <MenuItem key={l.id} value={l.id}>
              {l.name}
            </MenuItem>
          ))}
        </Select>
        <Tooltip title="배치안 관리">
          <span>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              disabled={!currentLayout}
              aria-label="배치안 관리"
            >
              <MoreVertRoundedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Menu anchorEl={menuAnchor} open={menuAnchor !== null} onClose={() => setMenuAnchor(null)}>
          <MenuItem onClick={openRename}>
            <ListItemIcon>
              <DriveFileRenameOutlineRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>이름 변경</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleDuplicate}>
            <ListItemIcon>
              <ContentCopyRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>복제</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
            <ListItemIcon>
              <DeleteOutlineRoundedIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText>삭제</ListItemText>
          </MenuItem>
        </Menu>
      </Box>

      {(() => {
        let text: string | null = null;
        let color = 'text.secondary';
        if (saveStatus === 'saving') { text = '저장 중…'; color = 'info.main'; }
        else if (saveStatus === 'error') { text = '저장 실패'; color = 'error.main'; }
        else if (dirty) { text = '저장 안 됨'; color = 'warning.main'; }
        else if (saveStatus === 'saved') { text = isCloud ? '클라우드 저장됨' : '저장됨'; color = 'success.main'; }
        return text ? (
          <Typography variant="caption" sx={{ fontWeight: 700, color, whiteSpace: 'nowrap' }}>
            ● {text}
          </Typography>
        ) : null;
      })()}

      <Box sx={{ flex: 1 }} />

      <Button
        variant="contained"
        size="small"
        startIcon={<SaveRoundedIcon />}
        onClick={handleSave}
        disabled={saving || readOnly}
      >
        저장
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={<SaveAsRoundedIcon />}
        onClick={openSaveAs}
        disabled={saving || readOnly}
      >
        다른 이름으로 저장
      </Button>

      {/* 보기 회전 (평면도 전용, 보기 전용 변환) */}
      {viewMode === 'plan' && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <Tooltip title="좌회전 90°">
            <IconButton size="small" onClick={() => rotateViewBy(-90)}>
              <RotateLeftRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="우회전 90°">
            <IconButton size="small" onClick={() => rotateViewBy(90)}>
              <RotateRightRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <TextField
            size="small"
            type="number"
            placeholder="각도"
            value={rotStr}
            onChange={(e) => setRotStr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyRotInput();
            }}
            onBlur={applyRotInput}
            sx={{ width: 76 }}
            slotProps={{ input: { endAdornment: <Typography variant="caption">°</Typography> } }}
          />
          {viewRotationDeg !== 0 && (
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={`보기 회전 ${viewRotationDeg}°`}
              onDelete={() => {
                setViewRotationDeg(0);
                setRotStr('');
              }}
            />
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* 부스 외곽 편집 (CAD 스타일) */}
          <Tooltip title={shapeEditMode ? '부스 편집 종료' : '부스 외곽을 꼭짓점/벽 드래그로 편집'}>
            <span>
              <Button
                variant={shapeEditMode ? 'contained' : 'outlined'}
                color={shapeEditMode ? 'warning' : 'primary'}
                size="small"
                startIcon={<PolylineRoundedIcon />}
                onClick={() => setShapeEditMode(!shapeEditMode)}
                disabled={!canEdit}
              >
                {shapeEditMode ? '편집 종료' : '부스 편집'}
              </Button>
            </span>
          </Tooltip>
          <Chip size="small" variant="outlined" label={`${boothAreaM2.toFixed(2)}㎡`} />
          {shapeEditMode && oobCount > 0 && (
            <Chip size="small" color="warning" label={`부스 밖 집기 ${oobCount}개`} />
          )}
        </>
      )}

      {readOnly && (
        <Chip
          size="small"
          color="info"
          icon={<VisibilityRoundedIcon />}
          label="읽기 전용으로 열람 중"
          sx={{ fontWeight: 700 }}
        />
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* 요소 추가 (메뉴로 그룹화) */}
      <Button
        variant="outlined"
        size="small"
        startIcon={<AddRoundedIcon />}
        endIcon={<ExpandMoreRoundedIcon />}
        onClick={(e) => setAddMenuAnchor(e.currentTarget)}
        disabled={!canEdit}
      >
        요소 추가
      </Button>
      <Menu anchorEl={addMenuAnchor} open={addMenuAnchor !== null} onClose={() => setAddMenuAnchor(null)}>
        <MenuItem onClick={() => { addText(); setAddMenuAnchor(null); }}>
          <ListItemIcon><TextFieldsRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>텍스트</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { addDimension(); setAddMenuAnchor(null); }}>
          <ListItemIcon><StraightenRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>치수선</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { fileInputRef.current?.click(); setAddMenuAnchor(null); }}>
          <ListItemIcon><AddPhotoAlternateRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>이미지</ListItemText>
        </MenuItem>
        {viewMode === 'plan' && (
          <MenuItem onClick={() => { svgInputRef.current?.click(); setAddMenuAnchor(null); }}>
            <ListItemIcon><WallpaperRoundedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>SVG 가져오기</ListItemText>
          </MenuItem>
        )}
      </Menu>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={handleImageFile}
      />
      <input
        ref={svgInputRef}
        type="file"
        accept="image/svg+xml,.svg"
        style={{ display: 'none' }}
        onChange={handleSvgFile}
      />
      {viewMode === 'plan' && svgDocuments.length > 0 && (
        <>
          <Button
            variant="text"
            size="small"
            startIcon={<AccountTreeRoundedIcon />}
            onClick={(e) => setSvgMenuAnchor(e.currentTarget)}
          >
            SVG 도면 {svgDocuments.length}
          </Button>
          <Menu anchorEl={svgMenuAnchor} open={svgMenuAnchor !== null} onClose={() => setSvgMenuAnchor(null)}>
            {svgDocuments.map((d) => (
              <MenuItem
                key={d.id}
                onClick={() => {
                  selectSvgDocument(d.id);
                  setSvgMenuAnchor(null);
                }}
              >
                {d.name} · 도형 {d.elements.length}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
      {viewMode === 'plan' && (
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showFixtureNames}
              onChange={(e) => setShowFixtureNames(e.target.checked)}
            />
          }
          label={<Typography variant="caption">집기명</Typography>}
          sx={{ ml: 0 }}
        />
      )}

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      {/* 내보내기 (메뉴로 그룹화) */}
      <Button
        variant="outlined"
        size="small"
        color="secondary"
        startIcon={<FileDownloadRoundedIcon />}
        endIcon={<ExpandMoreRoundedIcon />}
        onClick={(e) => setExportMenuAnchor(e.currentTarget)}
        disabled={exporting}
      >
        내보내기
      </Button>
      <Menu anchorEl={exportMenuAnchor} open={exportMenuAnchor !== null} onClose={() => setExportMenuAnchor(null)}>
        <MenuItem onClick={() => { setExportMenuAnchor(null); handleExportPNG(); }}>
          <ListItemIcon><ImageRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>PNG 저장</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setExportMenuAnchor(null); handleExportPDF(); }}>
          <ListItemIcon><PictureAsPdfRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>PDF 저장</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setExportMenuAnchor(null); setUsageOpen(true); }}>
          <ListItemIcon><ListAltRoundedIcon fontSize="small" /></ListItemIcon>
          <ListItemText>집기 리스트</ListItemText>
        </MenuItem>
      </Menu>

      <Tooltip title={project && !hasBoothHeight(project.boothConfig) ? '부스 높이를 설정해야 사용할 수 있습니다' : ''}>
        <span>
          <Button
            variant="contained"
            size="small"
            color="secondary"
            startIcon={<ViewInArRoundedIcon />}
            onClick={() => setIsoOpen(true)}
            disabled={!project || !hasBoothHeight(project.boothConfig)}
          >
            3D 미리보기
          </Button>
        </span>
      </Tooltip>

      <FixtureUsageDialog
        open={usageOpen}
        rows={computeFixtureUsage(placed, fixturesById)}
        onClose={() => setUsageOpen(false)}
      />
      <IsoPreviewDialog open={isoOpen} onClose={() => setIsoOpen(false)} />

      <Snackbar
        open={toast !== null}
        autoHideDuration={2000}
        onClose={() => setToast(null)}
        message={toast ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>다른 이름으로 저장</DialogTitle>
        <DialogContent>
          <TextField
            label="배치안 이름"
            placeholder="예) v2, 체험존 강조안"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveAs();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setDialogOpen(false)} disabled={saving}>
            취소
          </Button>
          <Button variant="contained" onClick={handleSaveAs} disabled={saving}>
            저장
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={svgImport !== null} onClose={() => setSvgImport(null)} maxWidth="xs" fullWidth>
        <DialogTitle>SVG 가져오기 방식</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            <b>{svgImport?.name}</b> 을(를) 어떻게 가져올까요?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · 배경: 도면 위에 참고용 이미지로 깔기<br />
            · SVG 객체: 내부 도형 구조를 분석해 검사(Inspector)
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setSvgImport(null)}>
            취소
          </Button>
          <Button variant="outlined" onClick={importAsBackground}>
            배경으로 가져오기
          </Button>
          <Button variant="contained" onClick={importAsObject}>
            SVG 객체로 가져오기
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={renameOpen} onClose={() => setRenameOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>배치안 이름 변경</DialogTitle>
        <DialogContent>
          <TextField
            label="배치안 이름"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setRenameOpen(false)} disabled={saving}>
            취소
          </Button>
          <Button variant="contained" onClick={handleRename} disabled={saving || renameName.trim().length === 0}>
            변경
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

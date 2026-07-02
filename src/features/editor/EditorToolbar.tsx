import { useRef, useState } from 'react';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
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
import ViewInArRoundedIcon from '@mui/icons-material/ViewInArRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import IsoPreviewDialog from '../iso/IsoPreviewDialog';
import { useEditor } from './EditorContext';
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
    fixturesById,
    layouts,
    currentLayoutId,
    dirty,
    saveCurrent,
    saveAs,
    loadLayout,
    suggestLayoutName,
    addText,
    addDimension,
    addImage,
    viewMode,
    wallItems,
  } = useEditor();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [usageOpen, setUsageOpen] = useState(false);
  const [isoOpen, setIsoOpen] = useState(false);

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
      fixturesById,
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
      heightMm: project.boothConfig.heightMm,
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
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="layout-select-label">배치안 선택</InputLabel>
        <Select
          labelId="layout-select-label"
          label="배치안 선택"
          value={currentLayoutId ?? ''}
          displayEmpty
          onChange={handleSelect}
          renderValue={(val) => {
            if (!val) return <em>저장된 배치안 없음</em>;
            return layouts.find((l) => l.id === val)?.name ?? '';
          }}
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
      </FormControl>

      {dirty && (
        <Typography variant="caption" color="warning.main" sx={{ fontWeight: 700 }}>
          ● 저장 안 됨
        </Typography>
      )}

      <Box sx={{ flex: 1 }} />

      <Button
        variant="contained"
        size="small"
        startIcon={<SaveRoundedIcon />}
        onClick={handleSave}
        disabled={saving}
      >
        저장
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={<SaveAsRoundedIcon />}
        onClick={openSaveAs}
        disabled={saving}
      >
        다른 이름으로 저장
      </Button>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Button
        variant="outlined"
        size="small"
        startIcon={<TextFieldsRoundedIcon />}
        onClick={addText}
      >
        텍스트 추가
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={<StraightenRoundedIcon />}
        onClick={addDimension}
      >
        치수선 추가
      </Button>
      <Button
        variant="outlined"
        size="small"
        startIcon={<AddPhotoAlternateRoundedIcon />}
        onClick={() => fileInputRef.current?.click()}
      >
        이미지 추가
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={handleImageFile}
      />

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Button
        variant="outlined"
        size="small"
        color="secondary"
        startIcon={<ImageRoundedIcon />}
        onClick={handleExportPNG}
        disabled={exporting}
      >
        PNG 저장
      </Button>
      <Button
        variant="outlined"
        size="small"
        color="secondary"
        startIcon={<PictureAsPdfRoundedIcon />}
        onClick={handleExportPDF}
        disabled={exporting}
      >
        PDF 저장
      </Button>
      <Button
        variant="text"
        size="small"
        startIcon={<ListAltRoundedIcon />}
        onClick={() => setUsageOpen(true)}
      >
        집기 리스트
      </Button>
      <Button
        variant="text"
        size="small"
        startIcon={<ViewInArRoundedIcon />}
        onClick={() => setIsoOpen(true)}
      >
        3D 미리보기
      </Button>

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
    </Paper>
  );
}

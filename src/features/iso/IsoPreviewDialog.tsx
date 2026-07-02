import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { useEditor } from '../editor/EditorContext';
import { buildIsoScene } from './scene';
import { renderIsoSceneToDataURL } from './renderIso';
import { preloadImages, buildBaseName, downloadDataURL } from '../export/download';
import { WALL_SIDES } from '../wall/constants';

/**
 * 아이소메트릭 3D 미리보기 Dialog (preview only, 편집 없음).
 * 평면도 배치/이미지 + 벽면 요소 + 집기 높이로 사선 시점 시안을 생성합니다.
 */
export default function IsoPreviewDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { project, placed, fixturesById, planImages, wallItems, layouts, currentLayoutId } = useEditor();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !project) {
      setDataUrl(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      // 모든 이미지(평면 + 벽면) 미리 로드
      const srcs = [
        ...planImages.map((i) => i.srcDataUrl),
        ...WALL_SIDES.flatMap((s) => wallItems[s].images.map((i) => i.srcDataUrl)),
      ];
      const imageEls = await preloadImages(srcs);
      const scene = buildIsoScene(project.boothConfig, placed, fixturesById, planImages, wallItems);
      const url = renderIsoSceneToDataURL(scene, imageEls);
      if (active) {
        setDataUrl(url);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, project, placed, fixturesById, planImages, wallItems]);

  const layoutName = layouts.find((l) => l.id === currentLayoutId)?.name ?? '미저장';

  const handleExport = () => {
    if (!dataUrl || !project) return;
    downloadDataURL(dataUrl, `${buildBaseName(project.name, layoutName)}_isometric.png`);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>아이소메트릭 미리보기</DialogTitle>
      <DialogContent dividers>
        <Box
          sx={{
            minHeight: 360,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#eef1f5',
            borderRadius: 1,
          }}
        >
          {loading && <CircularProgress />}
          {!loading && dataUrl && (
            <img src={dataUrl} alt="아이소메트릭 미리보기" style={{ maxWidth: '100%', maxHeight: '70vh' }} />
          )}
          {!loading && !dataUrl && (
            <Typography variant="body2" color="text.secondary">미리보기를 생성할 수 없습니다.</Typography>
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          편집 없는 미리보기입니다. 배치는 평면도/벽면에서 수정하세요. (현재 시점: 30° 아이소메트릭)
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">닫기</Button>
        <Button variant="contained" startIcon={<ImageRoundedIcon />} onClick={handleExport} disabled={!dataUrl}>
          PNG 저장
        </Button>
      </DialogActions>
    </Dialog>
  );
}

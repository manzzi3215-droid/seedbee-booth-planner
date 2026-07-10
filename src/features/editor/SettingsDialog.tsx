import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { useEditor } from './EditorContext';
import { resetCenterLayout } from './ResizableSplit';

const GRID_OPTIONS = [100, 250, 500, 1000];

/**
 * 설정(Settings) 다이얼로그 — Grid / Snap / 표시 토글 / 부스 크기 / 레이아웃.
 */
export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    gridSizeMm, setGridSizeMm, snapEnabled, setSnapEnabled,
    showFixtureNames, setShowFixtureNames, showDimensions, setShowDimensions,
    project, updateProjectInfo, updateBoothSize,
  } = useEditor();

  const bc = project?.boothConfig;
  const isPolygon = bc?.boothShape === 'polygon';

  // 부스 크기 입력(로컬 상태, blur/Enter 에서 커밋)
  const [w, setW] = useState('');
  const [d, setD] = useState('');
  const [h, setH] = useState('');
  useEffect(() => {
    if (open && bc) {
      setW(String(bc.widthMm));
      setD(String(bc.depthMm));
      setH(bc.heightMm == null ? '' : String(bc.heightMm));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bc?.widthMm, bc?.depthMm, bc?.heightMm]);

  const commitW = () => { const n = Number(w); if (n >= 100) updateBoothSize({ widthMm: n }); else setW(String(bc?.widthMm ?? '')); };
  const commitD = () => { const n = Number(d); if (n >= 100) updateBoothSize({ depthMm: n }); else setD(String(bc?.depthMm ?? '')); };
  const commitH = () => {
    if (h.trim() === '') { updateBoothSize({ heightMm: null }); return; }
    const n = Number(h);
    if (n >= 100) updateBoothSize({ heightMm: n }); else setH(bc?.heightMm == null ? '' : String(bc.heightMm));
  };
  const onKey = (e: React.KeyboardEvent, commit: () => void) => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); commit(); } };

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </Box>
      {children}
    </Stack>
  );

  const mm = { endAdornment: <InputAdornment position="end">mm</InputAdornment> };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>설정</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="overline" color="text.secondary">작업 환경</Typography>
          <Row label="그리드 크기" hint="스냅·격자 기준(mm)">
            <ToggleButtonGroup exclusive size="small" value={gridSizeMm} onChange={(_, v) => v && setGridSizeMm(v)}>
              {GRID_OPTIONS.map((g) => (
                <ToggleButton key={g} value={g} sx={{ px: 1.25, py: 0.25 }}>{g}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Row>
          <Row label="그리드 스냅" hint="이동 시 격자에 맞춤 (Shift 드래그: 스마트 스냅)">
            <Switch checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
          </Row>

          <Divider />
          <Typography variant="overline" color="text.secondary">부스 크기</Typography>
          {isPolygon ? (
            <Typography variant="caption" color="text.secondary">
              다각형(polygon) 부스는 <b>부스 편집</b>(꼭짓점 드래그)에서 형태를 조절하세요. 가로·세로·높이 직접 입력은 사각형 부스에서만 지원됩니다.
            </Typography>
          ) : (
            <Stack direction="row" spacing={1}>
              <TextField size="small" label="가로" type="number" value={w} onChange={(e) => setW(e.target.value)} onBlur={commitW} onKeyDown={(e) => onKey(e, commitW)} slotProps={{ input: mm }} fullWidth />
              <TextField size="small" label="세로" type="number" value={d} onChange={(e) => setD(e.target.value)} onBlur={commitD} onKeyDown={(e) => onKey(e, commitD)} slotProps={{ input: mm }} fullWidth />
              <TextField size="small" label="높이" type="number" value={h} onChange={(e) => setH(e.target.value)} onBlur={commitH} onKeyDown={(e) => onKey(e, commitH)} placeholder="미설정" slotProps={{ input: mm }} fullWidth />
            </Stack>
          )}

          <Divider />
          <Typography variant="overline" color="text.secondary">프로젝트 정보</Typography>
          <TextField size="small" label="행사명" value={project?.name ?? ''} onChange={(e) => updateProjectInfo({ name: e.target.value })} fullWidth />
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="브랜드" value={project?.brand ?? ''} onChange={(e) => updateProjectInfo({ brand: e.target.value })} fullWidth />
            <TextField size="small" label="담당자" value={project?.manager ?? ''} onChange={(e) => updateProjectInfo({ manager: e.target.value })} fullWidth />
          </Stack>
          <Stack direction="row" spacing={1}>
            <TextField size="small" label="행사 기간" value={project?.eventPeriod ?? ''} onChange={(e) => updateProjectInfo({ eventPeriod: e.target.value })} placeholder="예) 2026-03-01 ~ 03-05" fullWidth />
            <TextField size="small" label="장소" value={project?.place ?? ''} onChange={(e) => updateProjectInfo({ place: e.target.value })} fullWidth />
          </Stack>
          <TextField size="small" label="메모" value={project?.projectMemo ?? ''} onChange={(e) => updateProjectInfo({ projectMemo: e.target.value })} fullWidth multiline minRows={2} />

          <Divider />
          <Typography variant="overline" color="text.secondary">표시</Typography>
          <Row label="집기명 표시" hint="집기 위에 이름 표시 (치수와 독립)">
            <Switch checked={showFixtureNames} onChange={(e) => setShowFixtureNames(e.target.checked)} />
          </Row>
          <Row label="치수 표시" hint="집기 치수·간격·벽 치수 (부스 외곽 치수는 항상 표시)">
            <Switch checked={showDimensions} onChange={(e) => setShowDimensions(e.target.checked)} />
          </Row>

          <Divider />
          <Typography variant="overline" color="text.secondary">레이아웃</Typography>
          <Row label="중앙 패널 배치 초기화" hint="상단 영역·캔버스 높이를 기본값으로 복원(프로젝트 데이터 변경 없음)">
            <Button size="small" variant="outlined" onClick={resetCenterLayout}>초기화</Button>
          </Row>

          <Divider />
          <FormControlLabel control={<Switch checked disabled />} label={<Typography variant="body2">자동 저장 (5초) · 클라우드 동기화</Typography>} />
          <Typography variant="caption" color="text.secondary">
            단위 mm 고정. 테마/언어는 향후 지원 예정.
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>완료</Button>
      </DialogActions>
    </Dialog>
  );
}

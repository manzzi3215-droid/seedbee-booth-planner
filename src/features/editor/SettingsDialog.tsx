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
import { useEditor } from './EditorContext';

const GRID_OPTIONS = [100, 250, 500, 1000];

/**
 * 설정(Settings) 다이얼로그 (v0.9.5) — Grid / Snap / 집기명 등 작업 환경 설정.
 */
export default function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { gridSizeMm, setGridSizeMm, snapEnabled, setSnapEnabled, showFixtureNames, setShowFixtureNames, project, updateProjectInfo } = useEditor();

  const Row = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        {hint && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </Box>
      {children}
    </Stack>
  );

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
          <Row label="집기명 표시" hint="평면도에 집기 이름 표시">
            <Switch checked={showFixtureNames} onChange={(e) => setShowFixtureNames(e.target.checked)} />
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

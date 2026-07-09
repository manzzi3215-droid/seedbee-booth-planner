import { useState } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import AlignHorizontalLeftIcon from '@mui/icons-material/AlignHorizontalLeft';
import AlignHorizontalCenterIcon from '@mui/icons-material/AlignHorizontalCenter';
import AlignHorizontalRightIcon from '@mui/icons-material/AlignHorizontalRight';
import AlignVerticalTopIcon from '@mui/icons-material/AlignVerticalTop';
import AlignVerticalCenterIcon from '@mui/icons-material/AlignVerticalCenter';
import AlignVerticalBottomIcon from '@mui/icons-material/AlignVerticalBottom';
import ViewWeekRoundedIcon from '@mui/icons-material/ViewWeekRounded';
import ViewStreamRoundedIcon from '@mui/icons-material/ViewStreamRounded';
import AspectRatioRoundedIcon from '@mui/icons-material/AspectRatioRounded';
import HeightRoundedIcon from '@mui/icons-material/HeightRounded';
import RotateRightRoundedIcon from '@mui/icons-material/RotateRightRounded';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded';
import { useEditor } from '../editor/EditorContext';
import type { ArrayOptions } from '../editor/EditorContext';

/**
 * 다중 선택 시 캔버스 상단에 뜨는 플로팅 툴바 (v0.9.0).
 * Align / Group / Array / Duplicate / Delete 빠른 실행.
 * 좌우·상하 미러, 미러 복사, 균등 분배는 v1.0.8 에서 UI 숨김(함수는 유지).
 * plan 모드 + 집기 1개 이상 선택 시 표시. 정렬은 2개 이상에서 활성.
 */
export default function MultiActionToolbar() {
  const {
    viewMode,
    canEdit,
    selectedFixtureIds,
    alignFixtures,
    distributeFixtures,
    matchFixtures,
    arrayFixtures,
    duplicateFixtures,
    deleteFixtures,
    groupSelected,
    ungroupSelected,
    selectedGroupId,
  } = useEditor();

  const [arrayOpen, setArrayOpen] = useState(false);

  const n = selectedFixtureIds.length;
  if (viewMode !== 'plan' || !canEdit || n < 1) return null;

  const canAlign = n >= 2;
  const canDistribute = n >= 3;
  const canMatch = n >= 2;
  const canGroup = n >= 2 && selectedGroupId == null;
  const canUngroup = selectedGroupId != null;

  return (
    <>
      <Paper
        elevation={4}
        sx={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5,
          px: 1,
          py: 0.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          maxWidth: 'calc(100% - 24px)',
          overflowX: 'auto',
        }}
      >
        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
          <Chip size="small" color="primary" label={`${n}개 선택`} sx={{ mr: 0.5, height: 22 }} />

          {/* Align */}
          <IconBtn title="왼쪽 정렬" disabled={!canAlign} onClick={() => alignFixtures('left')}><AlignHorizontalLeftIcon fontSize="small" /></IconBtn>
          <IconBtn title="가로 중앙 정렬" disabled={!canAlign} onClick={() => alignFixtures('centerH')}><AlignHorizontalCenterIcon fontSize="small" /></IconBtn>
          <IconBtn title="오른쪽 정렬" disabled={!canAlign} onClick={() => alignFixtures('right')}><AlignHorizontalRightIcon fontSize="small" /></IconBtn>
          <IconBtn title="위 정렬" disabled={!canAlign} onClick={() => alignFixtures('top')}><AlignVerticalTopIcon fontSize="small" /></IconBtn>
          <IconBtn title="세로 중앙 정렬" disabled={!canAlign} onClick={() => alignFixtures('centerV')}><AlignVerticalCenterIcon fontSize="small" /></IconBtn>
          <IconBtn title="아래 정렬" disabled={!canAlign} onClick={() => alignFixtures('bottom')}><AlignVerticalBottomIcon fontSize="small" /></IconBtn>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* 동일 간격 / 크기 / 높이 / 회전 (v1.1.0) */}
          <IconBtn title="가로 동일 간격" disabled={!canDistribute} onClick={() => distributeFixtures('h')}><ViewWeekRoundedIcon fontSize="small" /></IconBtn>
          <IconBtn title="세로 동일 간격" disabled={!canDistribute} onClick={() => distributeFixtures('v')}><ViewStreamRoundedIcon fontSize="small" /></IconBtn>
          <IconBtn title="동일 크기(기준=첫 선택)" disabled={!canMatch} onClick={() => matchFixtures('size')}><AspectRatioRoundedIcon fontSize="small" /></IconBtn>
          <IconBtn title="동일 높이(기준=첫 선택)" disabled={!canMatch} onClick={() => matchFixtures('height')}><HeightRoundedIcon fontSize="small" /></IconBtn>
          <IconBtn title="동일 회전(기준=첫 선택)" disabled={!canMatch} onClick={() => matchFixtures('rotation')}><RotateRightRoundedIcon fontSize="small" /></IconBtn>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Group / Ungroup (v1.0.8) */}
          {canUngroup ? (
            <IconBtn title="그룹 해제" onClick={ungroupSelected} color="primary"><LinkOffRoundedIcon fontSize="small" /></IconBtn>
          ) : (
            <IconBtn title="그룹 만들기" disabled={!canGroup} onClick={groupSelected}><LinkRoundedIcon fontSize="small" /></IconBtn>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Array / Duplicate / Delete */}
          <IconBtn title="배열 복사 (Linear/Circular)" onClick={() => setArrayOpen(true)}><GridViewRoundedIcon fontSize="small" /></IconBtn>
          <IconBtn title="복제 (Ctrl+D)" onClick={duplicateFixtures}><ContentCopyRoundedIcon fontSize="small" /></IconBtn>
          <IconBtn title="삭제 (Delete)" onClick={deleteFixtures} color="error"><DeleteOutlineRoundedIcon fontSize="small" /></IconBtn>
        </Stack>
      </Paper>

      <ArrayDialog open={arrayOpen} onClose={() => setArrayOpen(false)} onApply={(o) => { arrayFixtures(o); setArrayOpen(false); }} />
    </>
  );
}

function IconBtn({
  title,
  onClick,
  disabled,
  color,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  color?: 'error' | 'primary';
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <span>
        <IconButton size="small" onClick={onClick} disabled={disabled} color={color}>
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/** 배열 복사 설정 다이얼로그 */
function ArrayDialog({ open, onClose, onApply }: { open: boolean; onClose: () => void; onApply: (o: ArrayOptions) => void }) {
  const [kind, setKind] = useState<'linear' | 'circular'>('linear');
  const [count, setCount] = useState(3);
  const [spacingX, setSpacingX] = useState(1000);
  const [spacingY, setSpacingY] = useState(0);
  const [totalAngle, setTotalAngle] = useState(360);

  const apply = () => {
    if (kind === 'linear') onApply({ kind: 'linear', count, spacingXMm: spacingX, spacingYMm: spacingY });
    else onApply({ kind: 'circular', count, totalAngleDeg: totalAngle });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>배열 복사</DialogTitle>
      <DialogContent>
        <ToggleButtonGroup exclusive size="small" value={kind} onChange={(_, v) => v && setKind(v)} sx={{ mb: 2, mt: 1 }}>
          <ToggleButton value="linear">Linear (직선)</ToggleButton>
          <ToggleButton value="circular">Circular (원형)</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          label="수량 (총 개수)"
          type="number"
          size="small"
          fullWidth
          value={count}
          onChange={(e) => setCount(Math.max(2, Math.round(Number(e.target.value) || 2)))}
          sx={{ mb: 2 }}
        />

        {kind === 'linear' ? (
          <Stack direction="row" spacing={1}>
            <TextField label="가로 간격(mm)" type="number" size="small" value={spacingX} onChange={(e) => setSpacingX(Math.round(Number(e.target.value) || 0))} />
            <TextField label="세로 간격(mm)" type="number" size="small" value={spacingY} onChange={(e) => setSpacingY(Math.round(Number(e.target.value) || 0))} />
          </Stack>
        ) : (
          <TextField
            label="전체 각도(°)"
            type="number"
            size="small"
            fullWidth
            value={totalAngle}
            onChange={(e) => setTotalAngle(Math.round(Number(e.target.value) || 0))}
            helperText="선택 집기들이 그룹 중심을 기준으로 배치됩니다."
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>취소</Button>
        <Button variant="contained" onClick={apply}>생성</Button>
      </DialogActions>
    </Dialog>
  );
}

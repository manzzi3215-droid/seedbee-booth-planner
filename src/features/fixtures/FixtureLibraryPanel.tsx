import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddLocationAltRoundedIcon from '@mui/icons-material/AddLocationAltRounded';
import type { FixtureDef } from '../../types';
import { getShapeLabel } from './shapes';
import FixtureFormDialog from './FixtureFormDialog';
import { useEditor } from '../editor/EditorContext';

/** 색상 스와치 */
function ColorSwatch({ color }: { color: string }) {
  return (
    <Box
      sx={{
        width: 18,
        height: 18,
        borderRadius: 0.75,
        bgcolor: color,
        border: '1px solid rgba(0,0,0,0.2)',
        flexShrink: 0,
      }}
    />
  );
}

/** 집기 카드 (사이드바용 컴팩트) */
function FixtureCard({
  fixture,
  onPlace,
  onEdit,
  onDelete,
}: {
  fixture: FixtureDef;
  onPlace: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        '&:hover .fixture-actions': { opacity: 1 },
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <ColorSwatch color={fixture.color} />
        <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }} noWrap>
          {fixture.name}
        </Typography>
        <Stack
          direction="row"
          className="fixture-actions"
          sx={{ opacity: { xs: 1, md: 0 }, transition: 'opacity 0.15s' }}
        >
          <Tooltip title="수정">
            <IconButton size="small" onClick={onEdit}>
              <EditRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="삭제">
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {fixture.widthMm}×{fixture.depthMm}×{fixture.heightMm ?? '-'} mm
      </Typography>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
        <Chip
          label={getShapeLabel(fixture.shape)}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: 11 }}
        />
        <Button
          size="small"
          variant="contained"
          startIcon={<AddLocationAltRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={onPlace}
          sx={{ py: 0.25, px: 1, minWidth: 0 }}
        >
          배치
        </Button>
      </Stack>
    </Paper>
  );
}

/**
 * 집기 라이브러리 패널 (편집기 왼쪽 사이드바).
 * 라이브러리 CRUD 와 [배치](캔버스에 추가)를 제공합니다.
 */
export default function FixtureLibraryPanel() {
  const { fixtures, fixturesLoading, saveFixture, deleteFixture, place } = useEditor();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixtureDef | null>(null);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (fixture: FixtureDef) => {
    setEditing(fixture);
    setDialogOpen(true);
  };

  const handleDelete = async (fixture: FixtureDef) => {
    if (!window.confirm(`"${fixture.name}" 집기를 삭제할까요?`)) return;
    await deleteFixture(fixture.id);
  };

  return (
    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
        집기 라이브러리
      </Typography>

      <Button
        variant="outlined"
        size="small"
        fullWidth
        startIcon={<AddRoundedIcon />}
        onClick={openAdd}
        sx={{ mb: 1.5 }}
      >
        집기 추가
      </Button>

      {fixturesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <Stack spacing={1} sx={{ overflowY: 'auto', pr: 0.5 }}>
          {fixtures.map((f) => (
            <FixtureCard
              key={f.id}
              fixture={f}
              onPlace={() => place(f)}
              onEdit={() => openEdit(f)}
              onDelete={() => handleDelete(f)}
            />
          ))}
          {fixtures.length === 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              등록된 집기가 없습니다.
            </Typography>
          )}
        </Stack>
      )}

      <FixtureFormDialog
        open={dialogOpen}
        fixture={editing}
        onClose={() => setDialogOpen(false)}
        onSubmit={saveFixture}
      />
    </Box>
  );
}

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
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
  selected,
  canEdit,
  onToggleSelect,
  onPlace,
  onEdit,
  onDelete,
}: {
  fixture: FixtureDef;
  selected: boolean;
  canEdit: boolean;
  onToggleSelect: () => void;
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
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper',
        borderRadius: 1.5,
        transition: 'border-color 0.15s, background-color 0.15s',
        '&:hover': { borderColor: selected ? 'primary.main' : 'text.disabled' },
        '&:hover .fixture-actions': { opacity: 1 },
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        <Checkbox
          size="small"
          checked={selected}
          onChange={onToggleSelect}
          sx={{ p: 0.25, mr: 0.25 }}
        />
        <ColorSwatch color={fixture.color} />
        <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }} noWrap title={fixture.name}>
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
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, ml: 3.5 }}>
        {fixture.widthMm}×{fixture.depthMm}×{fixture.heightMm ?? '-'} mm
      </Typography>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 0.75, ml: 3.5 }}>
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
          disabled={!canEdit}
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
 * 라이브러리 CRUD, [배치](캔버스에 추가), 다중 선택/일괄 삭제를 제공합니다.
 */
export default function FixtureLibraryPanel() {
  const { fixtures, fixturesLoading, saveFixture, deleteFixture, place, canEdit } = useEditor();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FixtureDef | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
    setSelectedIds((prev) => {
      const n = new Set(prev);
      n.delete(fixture.id);
      return n;
    });
  };

  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allSelected = fixtures.length > 0 && selectedIds.size === fixtures.length;
  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(fixtures.map((f) => f.id)));

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `선택한 ${ids.length}개 집기를 삭제할까요?\n` +
          `기본 제공(시드) 집기가 포함되어 있으면 함께 삭제되며 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }
    for (const id of ids) await deleteFixture(id);
    setSelectedIds(new Set());
  };

  const selectedCount = selectedIds.size;

  return (
    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          집기 라이브러리
        </Typography>
        <Chip label={`${fixtures.length}개`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
      </Stack>

      <Button
        variant="contained"
        size="small"
        fullWidth
        startIcon={<AddRoundedIcon />}
        onClick={openAdd}
        sx={{ mb: 1 }}
      >
        집기 추가
      </Button>

      {/* 다중 선택 컨트롤 */}
      {!fixturesLoading && fixtures.length > 0 && (
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, pl: 0.25 }}
        >
          <Stack direction="row" sx={{ alignItems: 'center' }}>
            <Checkbox
              size="small"
              checked={allSelected}
              indeterminate={selectedCount > 0 && !allSelected}
              onChange={toggleAll}
              sx={{ p: 0.25 }}
            />
            <Typography variant="caption" color="text.secondary">
              {selectedCount > 0 ? `${selectedCount}개 선택` : '전체 선택'}
            </Typography>
          </Stack>
          {selectedCount > 0 && (
            <Button
              size="small"
              color="error"
              variant="outlined"
              startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={handleBulkDelete}
              sx={{ py: 0.1, px: 1 }}
            >
              선택 삭제
            </Button>
          )}
        </Stack>
      )}

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
              selected={selectedIds.has(f.id)}
              canEdit={canEdit}
              onToggleSelect={() => toggleOne(f.id)}
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

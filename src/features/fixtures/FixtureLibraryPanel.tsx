import { useMemo, useState } from 'react';
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
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddLocationAltRoundedIcon from '@mui/icons-material/AddLocationAltRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { FixtureDef } from '../../types';
import { getShapeLabel } from './shapes';
import FixtureFormDialog from './FixtureFormDialog';
import CustomFixtureDialog from './CustomFixtureDialog';
import { useEditor } from '../editor/EditorContext';
import AssetManagerPanel from '../design/AssetManagerPanel';

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
  dragEnabled,
  dragOver,
  onToggleSelect,
  onPlace,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  fixture: FixtureDef;
  selected: boolean;
  canEdit: boolean;
  dragEnabled: boolean;
  dragOver: boolean;
  onToggleSelect: () => void;
  onPlace: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const isCustom = !!fixture.customAsset;
  return (
    <Paper
      elevation={0}
      draggable={dragEnabled}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      sx={{
        p: 1.25,
        border: '1px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'action.selected' : 'background.paper',
        borderRadius: 1.5,
        borderTop: dragOver ? '2px solid' : '1px solid',
        borderTopColor: dragOver ? 'primary.main' : undefined,
        transition: 'border-color 0.15s, background-color 0.15s',
        '&:hover': { borderColor: selected ? 'primary.main' : 'text.disabled' },
        '&:hover .fixture-actions': { opacity: 1 },
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
        {dragEnabled && (
          <DragIndicatorRoundedIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'grab', flexShrink: 0 }} />
        )}
        <Checkbox
          size="small"
          checked={selected}
          onChange={onToggleSelect}
          sx={{ p: 0.25, mr: 0.25 }}
        />
        {isCustom && fixture.customAsset?.kind === 'image' && fixture.customAsset.fileUrl ? (
          <Box sx={{ width: 18, height: 18, flexShrink: 0, borderRadius: 0.5, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.2)' }}>
            <img src={fixture.customAsset.fileUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </Box>
        ) : (
          <ColorSwatch color={fixture.color} />
        )}
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
/** 접기/펼치기 그룹 헤더 (v1.0.6) */
function GroupHeader({ title, count, open, onToggle }: { title: string; count: number; open: boolean; onToggle: () => void }) {
  return (
    <Stack
      direction="row"
      onClick={onToggle}
      sx={{ alignItems: 'center', gap: 0.5, py: 0.75, cursor: 'pointer', userSelect: 'none', '&:hover': { color: 'primary.main' } }}
    >
      <ExpandMoreRoundedIcon sx={{ fontSize: 20, transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{title}</Typography>
      <Chip label={`${count}개`} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
    </Stack>
  );
}

export default function FixtureLibraryPanel() {
  const { fixtures, fixturesLoading, saveFixture, deleteFixture, reorderFixtures, place, canEdit, designAssets } = useEditor();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [editing, setEditing] = useState<FixtureDef | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fixOpen, setFixOpen] = useState(true);
  const [assetOpen, setAssetOpen] = useState(false);
  // 검색 · 폴더(카테고리) 필터 (v1.0.9)
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all'); // 'all' | 'none' | <category>
  // 드래그 정렬 (v1.1.1)
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of fixtures) if (f.category) set.add(f.category);
    return [...set].sort();
  }, [fixtures]);

  // order 기준 정렬 — order 없으면 현재(추가) 순서 유지(뒤로) → 하위 호환 (v1.1.1)
  const ordered = useMemo(() => {
    return fixtures
      .map((f, i) => ({ f, key: f.order ?? i + fixtures.length }))
      .sort((a, b) => a.key - b.key)
      .map((x) => x.f);
  }, [fixtures]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordered.filter((f) => {
      if (catFilter === 'none' && f.category) return false;
      if (catFilter !== 'all' && catFilter !== 'none' && f.category !== catFilter) return false;
      if (!q) return true;
      return [f.name, f.category, f.memo].filter(Boolean).some((s) => s!.toLowerCase().includes(q));
    });
  }, [ordered, query, catFilter]);

  // 드래그 정렬: 보이는 목록 내에서 순서를 바꾼 뒤, 전체 order 로 반영 (필터 상태에서도 안전)
  const handleReorder = (toId: string) => {
    if (!dragId || dragId === toId) return;
    const visIds = filtered.map((f) => f.id);
    const from = visIds.indexOf(dragId);
    const to = visIds.indexOf(toId);
    if (from < 0 || to < 0) return;
    const newVis = [...visIds];
    newVis.splice(from, 1);
    newVis.splice(to, 0, dragId);
    // 전체 순서에 되반영: 보이는 슬롯을 newVis 순서로 채우고, 안 보이는 항목은 그대로
    const visSet = new Set(visIds);
    let vi = 0;
    const newFull = ordered.map((f) => (visSet.has(f.id) ? newVis[vi++] : f.id));
    void reorderFixtures(newFull);
  };

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
    <Box sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* 그룹 1: 집기 라이브러리 (접기/펼치기) */}
      <GroupHeader title="집기 라이브러리" count={fixtures.length} open={fixOpen} onToggle={() => setFixOpen((v) => !v)} />
      {fixOpen && (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', mb: 1 }}>
          <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexShrink: 0 }}>
            <Button variant="contained" size="small" fullWidth startIcon={<AddRoundedIcon />} onClick={openAdd}>
              집기 추가
            </Button>
            <Button variant="outlined" size="small" fullWidth startIcon={<AddPhotoAlternateRoundedIcon />} onClick={() => setCustomOpen(true)} disabled={!canEdit}>
              커스텀(이미지/3D)
            </Button>
          </Stack>

          {/* 검색 (v1.0.9) */}
          {!fixturesLoading && fixtures.length > 0 && (
            <TextField
              size="small"
              placeholder="집기명 · 카테고리 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              sx={{ mb: 1, flexShrink: 0 }}
              slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchRoundedIcon sx={{ fontSize: 18 }} /></InputAdornment>) } }}
            />
          )}

          {/* 폴더(카테고리) 필터 (v1.0.9) */}
          {categories.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1, flexShrink: 0 }}>
              <Chip label="전체" size="small" color={catFilter === 'all' ? 'primary' : 'default'} variant={catFilter === 'all' ? 'filled' : 'outlined'} onClick={() => setCatFilter('all')} sx={{ height: 22, fontSize: 11 }} />
              {categories.map((c) => (
                <Chip key={c} label={c} size="small" color={catFilter === c ? 'primary' : 'default'} variant={catFilter === c ? 'filled' : 'outlined'} onClick={() => setCatFilter(c)} sx={{ height: 22, fontSize: 11 }} />
              ))}
              <Chip label="미분류" size="small" color={catFilter === 'none' ? 'primary' : 'default'} variant={catFilter === 'none' ? 'filled' : 'outlined'} onClick={() => setCatFilter('none')} sx={{ height: 22, fontSize: 11 }} />
            </Box>
          )}

          {/* 다중 선택 컨트롤 */}
          {!fixturesLoading && fixtures.length > 0 && (
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1, pl: 0.25, flexShrink: 0 }}>
              <Stack direction="row" sx={{ alignItems: 'center' }}>
                <Checkbox size="small" checked={allSelected} indeterminate={selectedCount > 0 && !allSelected} onChange={toggleAll} sx={{ p: 0.25 }} />
                <Typography variant="caption" color="text.secondary">
                  {selectedCount > 0 ? `${selectedCount}개 선택` : '전체 선택'}
                </Typography>
              </Stack>
              {selectedCount > 0 && (
                <Button size="small" color="error" variant="outlined" startIcon={<DeleteOutlineRoundedIcon sx={{ fontSize: 16 }} />} onClick={handleBulkDelete} sx={{ py: 0.1, px: 1 }}>
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
            <Stack spacing={1} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 0.5 }}>
              {filtered.map((f) => (
                <FixtureCard
                  key={f.id}
                  fixture={f}
                  selected={selectedIds.has(f.id)}
                  canEdit={canEdit}
                  dragEnabled={canEdit && filtered.length > 1}
                  dragOver={dragOverId === f.id && dragId !== f.id}
                  onToggleSelect={() => toggleOne(f.id)}
                  onPlace={() => place(f)}
                  onEdit={() => openEdit(f)}
                  onDelete={() => handleDelete(f)}
                  onDragStart={() => setDragId(f.id)}
                  onDragOver={(e) => { e.preventDefault(); if (dragOverId !== f.id) setDragOverId(f.id); }}
                  onDrop={() => { handleReorder(f.id); setDragId(null); setDragOverId(null); }}
                  onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                />
              ))}
              {fixtures.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  등록된 집기가 없습니다.
                </Typography>
              )}
              {fixtures.length > 0 && filtered.length === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  검색 결과가 없습니다.
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      )}

      {/* 그룹 2: 디자인 에셋 (접기/펼치기) */}
      <Box sx={{ flexShrink: 0, borderTop: '1px solid', borderColor: 'divider', pt: 0.5 }}>
        <GroupHeader title="디자인 에셋" count={designAssets.length} open={assetOpen} onToggle={() => setAssetOpen((v) => !v)} />
        {assetOpen && (
          <Box sx={{ maxHeight: '45vh', overflowY: 'auto', pr: 0.5 }}>
            <AssetManagerPanel embedded />
          </Box>
        )}
      </Box>

      <FixtureFormDialog open={dialogOpen} fixture={editing} onClose={() => setDialogOpen(false)} onSubmit={saveFixture} />
      <CustomFixtureDialog open={customOpen} onClose={() => setCustomOpen(false)} onSave={saveFixture} />
    </Box>
  );
}

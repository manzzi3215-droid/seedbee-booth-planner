import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import AddLocationAltRoundedIcon from '@mui/icons-material/AddLocationAltRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import VerticalAlignTopRoundedIcon from '@mui/icons-material/VerticalAlignTopRounded';
import VerticalAlignBottomRoundedIcon from '@mui/icons-material/VerticalAlignBottomRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import type { FixtureDef } from '../../types';
import { getShapeLabel } from './shapes';
import FixtureFormDialog from './FixtureFormDialog';
import CustomFixtureDialog from './CustomFixtureDialog';
import { useEditor } from '../editor/EditorContext';
import AssetManagerPanel from '../design/AssetManagerPanel';
import { hasLocalModel } from '../../firebase/modelStorage';

/** 3D 모델 집기 카드용 로컬 캐시 상태 칩 (v1.1.6) — 이 브라우저 IndexedDB 에 원본이 있는지 표시 */
function ModelCacheChip({ fixture }: { fixture: FixtureDef }) {
  const key = fixture.customAsset?.localModelId ?? fixture.id;
  const [state, setState] = useState<'loading' | 'local' | 'missing'>('loading');
  useEffect(() => {
    let active = true;
    hasLocalModel(key).then((has) => {
      if (active) setState(has ? 'local' : 'missing');
    });
    return () => {
      active = false;
    };
  }, [key]);
  if (state === 'loading') return null;
  return state === 'local' ? (
    <Chip label="로컬 모델 있음" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
  ) : (
    <Chip label="모델 파일 없음" size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
  );
}

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
  showMove,
  canMoveUp,
  canMoveDown,
  onToggleSelect,
  onPlace,
  onEdit,
  onDelete,
  onMove,
}: {
  fixture: FixtureDef;
  selected: boolean;
  canEdit: boolean;
  showMove: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleSelect: () => void;
  onPlace: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (dir: 'top' | 'up' | 'down' | 'bottom') => void;
}) {
  const isCustom = !!fixture.customAsset;
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
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', minWidth: 0, flexWrap: 'wrap', rowGap: 0.5 }}>
          <Chip
            label={getShapeLabel(fixture.shape)}
            size="small"
            variant="outlined"
            sx={{ height: 20, fontSize: 11 }}
          />
          {fixture.customAsset?.kind === 'model' && <ModelCacheChip fixture={fixture} />}
        </Stack>
        <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
          {/* 순서 변경 버튼 (v1.1.3) — 드래그 대신 안정적인 이동 */}
          {showMove && (
            <>
              <Tooltip title="맨 위로"><span><IconButton size="small" disabled={!canMoveUp} onClick={() => onMove('top')} sx={{ p: 0.25 }}><VerticalAlignTopRoundedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
              <Tooltip title="위로"><span><IconButton size="small" disabled={!canMoveUp} onClick={() => onMove('up')} sx={{ p: 0.25 }}><KeyboardArrowUpRoundedIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
              <Tooltip title="아래로"><span><IconButton size="small" disabled={!canMoveDown} onClick={() => onMove('down')} sx={{ p: 0.25 }}><KeyboardArrowDownRoundedIcon sx={{ fontSize: 18 }} /></IconButton></span></Tooltip>
              <Tooltip title="맨 아래로"><span><IconButton size="small" disabled={!canMoveDown} onClick={() => onMove('bottom')} sx={{ p: 0.25 }}><VerticalAlignBottomRoundedIcon sx={{ fontSize: 16 }} /></IconButton></span></Tooltip>
            </>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<AddLocationAltRoundedIcon sx={{ fontSize: 16 }} />}
            onClick={onPlace}
            disabled={!canEdit}
            sx={{ py: 0.25, px: 1, minWidth: 0, ml: 0.5 }}
          >
            배치
          </Button>
        </Stack>
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
  // 순서 변경 (v1.1.3) — 버튼 방식. 검색 중에는 숨김, 카테고리 필터 상태에선 해당 목록 안에서만.
  const [reorderError, setReorderError] = useState<string | null>(null);
  const searching = query.trim() !== '';
  const showMove = canEdit && !searching; // 검색 중 순서 변경 비활성

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const f of fixtures) if (f.category) set.add(f.category);
    return [...set].sort();
  }, [fixtures]);

  // 결정적 정렬 (v1.1.2) — order 값이 있는 집기는 order 오름차순으로 앞에,
  // order 가 없는 기존 집기는 저장(추가) 순서 그대로 뒤에. index 와 order 값을 섞지 않아
  // 부분적으로만 order 가 있는 상태에서도 항목이 튀지 않습니다.
  const ordered = useMemo(() => {
    const withOrder = fixtures
      .filter((f) => typeof f.order === 'number')
      .sort((a, b) => (a.order as number) - (b.order as number));
    const withoutOrder = fixtures.filter((f) => typeof f.order !== 'number');
    return [...withOrder, ...withoutOrder];
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

  // 순서 이동 (v1.1.3) — 보이는(필터된) 목록 안에서 이동한 뒤, 전체 order 배열의
  // '보이는 슬롯'만 새 순서로 되메워 카테고리 필터 상태에서도 다른 카테고리는 건드리지 않음.
  const moveFixture = (id: string, dir: 'top' | 'up' | 'down' | 'bottom') => {
    const visIds = filtered.map((f) => f.id);
    const from = visIds.indexOf(id);
    if (from < 0) return;
    const to =
      dir === 'top' ? 0 : dir === 'bottom' ? visIds.length - 1 : dir === 'up' ? Math.max(0, from - 1) : Math.min(visIds.length - 1, from + 1);
    if (to === from) return;
    const newVis = [...visIds];
    newVis.splice(from, 1);
    newVis.splice(to, 0, id);
    const visSet = new Set(visIds);
    let vi = 0;
    const newFull = ordered.map((f) => (visSet.has(f.id) ? newVis[vi++] : f.id));
    setReorderError(null);
    // 원자적 저장 실패 시 에러 표시(상태는 그대로라 이전 순서 유지)
    reorderFixtures(newFull).catch(() => setReorderError('순서 저장에 실패했습니다. 잠시 후 다시 시도하세요.'));
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

          {reorderError && <Alert severity="warning" onClose={() => setReorderError(null)} sx={{ mb: 1, flexShrink: 0 }}>{reorderError}</Alert>}

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
              {filtered.map((f, i) => (
                <FixtureCard
                  key={f.id}
                  fixture={f}
                  selected={selectedIds.has(f.id)}
                  canEdit={canEdit}
                  showMove={showMove && filtered.length > 1}
                  canMoveUp={i > 0}
                  canMoveDown={i < filtered.length - 1}
                  onToggleSelect={() => toggleOne(f.id)}
                  onPlace={() => place(f)}
                  onEdit={() => openEdit(f)}
                  onDelete={() => handleDelete(f)}
                  onMove={(dir) => moveFixture(f.id, dir)}
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

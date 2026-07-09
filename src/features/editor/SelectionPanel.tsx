import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Collapse from '@mui/material/Collapse';
import InputAdornment from '@mui/material/InputAdornment';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import Rotate90DegreesCwRoundedIcon from '@mui/icons-material/Rotate90DegreesCwRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';
import { useNavigate } from 'react-router-dom';
import { useEditor } from './EditorContext';
import { getShapeLabel } from '../fixtures/shapes';
import { isFixtureOutOfBounds } from '../canvas/fixtureGeometry';
import { getBoothPolygon } from '../canvas/boothGeometry';
import TextPanel from './TextPanel';
import DimensionPanel from './DimensionPanel';
import ImagePanel from './ImagePanel';
import BackgroundPanel from './BackgroundPanel';
import SvgInspectorPanel from './SvgInspectorPanel';
import ConvertedFixtureEditor from './ConvertedFixtureEditor';
import DesignPanel from '../design/DesignPanel';
import ProductInfoPanel from '../products/ProductPanel';

/**
 * 접이식 섹션 (v1.0.8) — 오른쪽 선택 패널의 옵션이 많아져 복잡해지는 것을 방지.
 * 열림/닫힘 상태는 localStorage 에 저장되어 사용자 조작 후 유지됩니다.
 */
function CollapsibleSection({
  id,
  title,
  defaultOpen = false,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const storageKey = `blp:panel:${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    return saved == null ? defaultOpen : saved === '1';
  });
  const toggle = () => {
    setOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(storageKey, next ? '1' : '0');
      } catch {
        /* localStorage 사용 불가 무시 */
      }
      return next;
    });
  };
  return (
    <Box sx={{ mb: 0.5 }}>
      <Stack
        direction="row"
        onClick={toggle}
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          py: 0.75,
          userSelect: 'none',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
          {title}
        </Typography>
        <ExpandMoreRoundedIcon
          fontSize="small"
          sx={{ color: 'text.disabled', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pb: 1 }}>{children}</Box>
      </Collapse>
    </Box>
  );
}

/** 빈 선택 상태 */
function EmptyPanel() {
  return (
    <Box sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>
        선택 정보
      </Typography>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          color: 'text.secondary',
          mt: 6,
        }}
      >
        <InfoOutlinedIcon sx={{ fontSize: 40 }} />
        <Typography variant="body2">선택된 항목이 없습니다</Typography>
      </Box>
    </Box>
  );
}

/**
 * 오른쪽 선택 정보 패널 (디스패처).
 * 선택 타입(집기/텍스트)에 따라 알맞은 패널을 렌더링합니다.
 */
export default function SelectionPanel() {
  const { selectedItem } = useEditor();
  if (selectedItem?.type === 'text') return <TextPanel />;
  if (selectedItem?.type === 'dimension') return <DimensionPanel />;
  if (selectedItem?.type === 'image') return <ImagePanel />;
  if (selectedItem?.type === 'background') return <BackgroundPanel />;
  if (selectedItem?.type === 'svg') return <SvgInspectorPanel />;
  if (selectedItem?.type === 'product') return <ProductInfoPanel />;
  if (selectedItem?.type === 'fixture') return <FixtureInfoPanel />;
  return <EmptyPanel />;
}

/** 집기 선택 정보 + 위치/회전 직접 입력 + 회전/복사/삭제 */
function FixtureInfoPanel() {
  const {
    placed,
    selectedFixtureId,
    fixturesById,
    localFixtures,
    project,
    rotateSelected,
    copySelected,
    deleteSelected,
    setSelectedPosition,
    setSelectedRotation,
  } = useEditor();
  const navigate = useNavigate();

  const selected = placed.find((p) => p.id === selectedFixtureId) ?? null;
  const def = selected ? fixturesById.get(selected.fixtureDefId) : null;
  const isLocalFixture = !!def && localFixtures.some((f) => f.id === def.id);

  // 위치/회전 직접 입력용 로컬 상태 (선택 집기 값 변화 시 동기화)
  const [xStr, setXStr] = useState('');
  const [yStr, setYStr] = useState('');
  const [rotStr, setRotStr] = useState('');

  useEffect(() => {
    if (selected) {
      setXStr(String(Math.round(selected.xMm)));
      setYStr(String(Math.round(selected.yMm)));
      setRotStr(String(selected.rotationDeg));
    }
  }, [selected?.id, selected?.xMm, selected?.yMm, selected?.rotationDeg, selected]);

  if (!selected || !def) {
    return (
      <Box sx={{ p: 2, height: '100%' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2 }}>
          선택 정보
        </Typography>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            color: 'text.secondary',
            mt: 6,
          }}
        >
          <InfoOutlinedIcon sx={{ fontSize: 40 }} />
          <Typography variant="body2">선택된 집기가 없습니다</Typography>
        </Box>
      </Box>
    );
  }

  const booth = project?.boothConfig;
  const oob =
    booth != null &&
    isFixtureOutOfBounds(selected, def, getBoothPolygon(booth));

  const applyTransform = () => {
    const x = Number(xStr);
    const y = Number(yStr);
    const rot = Number(rotStr);
    if (!Number.isNaN(x) && !Number.isNaN(y)) {
      setSelectedPosition(x, y);
    }
    if (!Number.isNaN(rot)) {
      setSelectedRotation(rot);
    }
  };

  const onFieldKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') applyTransform();
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.5 }}>
        선택 정보
      </Typography>

      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Box
          sx={{
            width: 20,
            height: 20,
            borderRadius: 0.75,
            bgcolor: def.color,
            border: '1px solid rgba(0,0,0,0.2)',
          }}
        />
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
          {def.name}
        </Typography>
      </Stack>
      <Chip
        label={getShapeLabel(def.shape)}
        size="small"
        variant="outlined"
        sx={{ alignSelf: 'flex-start', mb: 1 }}
      />

      {oob && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          집기가 부스 영역을 벗어났습니다.
        </Alert>
      )}

      <Divider sx={{ my: 1 }} />

      {/* SVG 변환 집기: 편집 + 라이브러리 저장. 일반 집기: 읽기 전용 치수 */}
      {isLocalFixture && def ? (
        <ConvertedFixtureEditor def={def} />
      ) : (
        <>
          <Stack direction="row" sx={{ justifyContent: 'space-between', py: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              가로×세로×높이
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {def.widthMm}×{def.depthMm}×{def.heightMm ?? '-'} mm
            </Typography>
          </Stack>

          <Divider sx={{ my: 1 }} />
        </>
      )}

      {/* 3D 재질 편집 UI 제거(v1.0.6). 내부 material 값/렌더링은 그대로 유지. */}

      {/* 디자인 매핑 · 색상/재질 등 고급 옵션은 접이식으로(기본 닫힘, v1.0.8) */}
      <CollapsibleSection id="design" title="디자인 매핑 · 색상">
        <DesignPanel fixture={selected} />
      </CollapsibleSection>

      <Divider sx={{ my: 1 }} />

      <CollapsibleSection id="vmd" title="기타 · VMD 시안">
        {/* 이 집기 상판 사이즈로 VMD 시안 만들기 (§12, v1.0.1) */}
        <Button
          variant="outlined"
          size="small"
          fullWidth
          startIcon={<DashboardCustomizeRoundedIcon />}
          onClick={() => project && navigate(`/projects/${project.id}/vmd?w=${def.widthMm}&h=${def.depthMm}&name=${encodeURIComponent(def.name)}`)}
        >
          이 집기로 VMD 시안 만들기
        </Button>
      </CollapsibleSection>

      <Divider sx={{ my: 1 }} />

      {/* 위치/회전 직접 입력 (기본정보 — 항상 열림) */}
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
        위치 · 회전 직접 입력
      </Typography>
      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          label="X"
          type="number"
          size="small"
          value={xStr}
          onChange={(e) => setXStr(e.target.value)}
          onKeyDown={onFieldKeyDown}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }}
        />
        <TextField
          label="Y"
          type="number"
          size="small"
          value={yStr}
          onChange={(e) => setYStr(e.target.value)}
          onKeyDown={onFieldKeyDown}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">mm</InputAdornment> } }}
        />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'stretch' }}>
        <TextField
          label="회전"
          type="number"
          size="small"
          value={rotStr}
          onChange={(e) => setRotStr(e.target.value)}
          onKeyDown={onFieldKeyDown}
          slotProps={{ input: { endAdornment: <InputAdornment position="end">°</InputAdornment> } }}
        />
        <Button variant="contained" size="small" onClick={applyTransform} sx={{ flex: 1 }}>
          적용
        </Button>
      </Stack>

      {/* 빠른 회전 각도 (Rotate Gizmo) — v0.9.0 */}
      <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap', gap: 0.5 }}>
        {[0, 45, 90, 135, 180].map((deg) => (
          <Button
            key={deg}
            variant="outlined"
            size="small"
            onClick={() => {
              setSelectedRotation(deg);
              setRotStr(String(deg));
            }}
            sx={{ minWidth: 0, px: 1, py: 0.25 }}
          >
            {deg}°
          </Button>
        ))}
      </Stack>

      <Divider sx={{ my: 1.5 }} />

      <Stack spacing={1}>
        <Button
          variant="outlined"
          startIcon={<Rotate90DegreesCwRoundedIcon />}
          onClick={rotateSelected}
          fullWidth
        >
          90도 회전
        </Button>
        <Button
          variant="outlined"
          startIcon={<ContentCopyRoundedIcon />}
          onClick={copySelected}
          fullWidth
        >
          복사
        </Button>
        <Button
          variant="outlined"
          color="error"
          startIcon={<DeleteOutlineRoundedIcon />}
          onClick={deleteSelected}
          fullWidth
        >
          삭제
        </Button>
      </Stack>
    </Box>
  );
}

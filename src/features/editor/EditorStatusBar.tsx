import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import GridOnRoundedIcon from '@mui/icons-material/GridOnRounded';
import { useEditor } from './EditorContext';
import { getBoothPolygon, polygonAreaMm2 } from '../canvas/boothGeometry';

/**
 * 하단 상태바 (v0.9.5) — 확대율/그리드/스냅/선택/면적/집기·제품 개수 자동 표시.
 * 전문 CAD 프로그램처럼 현재 작업 컨텍스트를 한눈에.
 */
export default function EditorStatusBar({ zoom }: { zoom: number }) {
  const {
    project,
    placed,
    placedProducts,
    gridSizeMm,
    snapEnabled,
    selectedFixtureIds,
    selectedItem,
  } = useEditor();

  const areaM2 = project ? polygonAreaMm2(getBoothPolygon(project.boothConfig)) / 1_000_000 : 0;
  const selCount = selectedFixtureIds.length > 1 ? selectedFixtureIds.length : selectedItem ? 1 : 0;

  const Item = ({ label, value }: { label: string; value: string }) => (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 700 }}>{value}</Typography>
    </Stack>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 1.5,
        py: 0.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flexWrap: 'wrap',
        minHeight: 30,
      }}
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', color: 'text.secondary' }}>
        <GridOnRoundedIcon sx={{ fontSize: 14 }} />
        <Typography variant="caption" sx={{ fontWeight: 700 }}>{gridSizeMm}mm</Typography>
      </Stack>
      <Divider orientation="vertical" flexItem />
      <Item label="스냅" value={snapEnabled ? 'ON' : 'OFF'} />
      <Divider orientation="vertical" flexItem />
      <Item label="확대" value={`${Math.round(zoom * 100)}%`} />
      <Divider orientation="vertical" flexItem />
      <Item label="선택" value={`${selCount}`} />
      <Box sx={{ flex: 1 }} />
      <Item label="면적" value={`${areaM2.toFixed(2)}㎡`} />
      <Divider orientation="vertical" flexItem />
      <Item label="집기" value={`${placed.length}`} />
      <Divider orientation="vertical" flexItem />
      <Item label="제품" value={`${placedProducts.length}`} />
    </Box>
  );
}

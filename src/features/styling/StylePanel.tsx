import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { useEditor } from '../editor/EditorContext';
import {
  ENVIRONMENTS,
  FLOOR_MATERIALS,
  STYLE_PRESETS,
  WALL_MATERIALS,
  DEFAULT_ENVIRONMENT,
  DEFAULT_FLOOR_MATERIAL,
  DEFAULT_WALL_MATERIAL,
} from './styling';
import type { EnvironmentId, FloorMaterialId, WallMaterialId } from '../../types';

/** 색 스와치 버튼 */
function Swatch({
  label,
  color,
  active,
  onClick,
  disabled,
  ring,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  ring?: string;
}) {
  return (
    <Tooltip title={label}>
      <Box
        component="button"
        onClick={onClick}
        disabled={disabled}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.25,
          p: 0,
          border: 'none',
          background: 'none',
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          width: 54,
        }}
      >
        <Box
          sx={{
            width: 46,
            height: 34,
            borderRadius: 1,
            background: ring ?? color,
            border: '2px solid',
            borderColor: active ? 'primary.main' : 'divider',
            boxShadow: active ? '0 0 0 2px rgba(37,99,235,0.25)' : 'none',
          }}
        />
        <Typography variant="caption" sx={{ fontSize: 10, lineHeight: 1.1, textAlign: 'center', color: active ? 'primary.main' : 'text.secondary', fontWeight: active ? 700 : 500 }} noWrap>
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}

/**
 * Style Panel (Professional Styling System, v0.9.8).
 * Quick Style 프리셋 + 바닥/벽 재질 + 3D 환경을 한 곳에서 선택.
 * 데이터는 boothConfig.styling 에 저장(자동 저장/Undo/공유). 3D 미리보기·2D 바닥에 반영.
 */
export default function StylePanel() {
  const { project, updateBoothStyling, applyStylePreset, canEdit } = useEditor();
  const styling = project?.boothConfig.styling ?? {};
  const floor = styling.floorMaterial ?? DEFAULT_FLOOR_MATERIAL;
  const wall = styling.wallMaterial ?? DEFAULT_WALL_MATERIAL;
  const env = styling.environment ?? DEFAULT_ENVIRONMENT;

  return (
    <Box sx={{ p: 1.5, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
        스타일 · 재질 (Styling)
      </Typography>

      {/* Quick Style 프리셋 */}
      <Paper elevation={0} sx={{ p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.75 }}>
          <AutoAwesomeRoundedIcon sx={{ fontSize: 16, color: 'primary.main' }} />
          <Typography variant="caption" sx={{ fontWeight: 800 }}>Quick Style</Typography>
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5 }}>
          {STYLE_PRESETS.map((p) => (
            <Box
              key={p.id}
              component="button"
              disabled={!canEdit}
              onClick={() => applyStylePreset(p.id)}
              sx={{
                py: 0.6,
                px: 1,
                borderRadius: 1,
                cursor: canEdit ? 'pointer' : 'default',
                fontSize: 12,
                fontWeight: styling.stylePreset === p.id ? 800 : 600,
                border: '1px solid',
                borderColor: styling.stylePreset === p.id ? 'primary.main' : 'divider',
                bgcolor: styling.stylePreset === p.id ? 'primary.main' : 'background.paper',
                color: styling.stylePreset === p.id ? 'primary.contrastText' : 'text.primary',
              }}
            >
              {p.label}
            </Box>
          ))}
        </Box>
      </Paper>

      {/* 바닥 재질 */}
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5 }}>바닥 재질 (Floor)</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {FLOOR_MATERIALS.map((m) => (
            <Swatch
              key={m.id}
              label={m.label}
              color={m.color}
              ring={m.checker ? `repeating-conic-gradient(${m.color} 0% 25%, ${shade(m.color)} 0% 50%) 50% / 16px 16px` : m.color}
              active={floor === m.id}
              disabled={!canEdit}
              onClick={() => updateBoothStyling({ floorMaterial: m.id as FloorMaterialId, stylePreset: undefined })}
            />
          ))}
        </Box>
      </Box>

      {/* 벽 재질 */}
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5 }}>벽 재질 (Wall)</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {WALL_MATERIALS.map((m) => (
            <Swatch
              key={m.id}
              label={m.label}
              color={m.color}
              active={wall === m.id}
              disabled={!canEdit}
              onClick={() => updateBoothStyling({ wallMaterial: m.id as WallMaterialId, stylePreset: undefined })}
            />
          ))}
        </Box>
      </Box>

      {/* 3D 환경 */}
      <Box>
        <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', mb: 0.5 }}>3D 환경 (Environment)</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {ENVIRONMENTS.map((e) => (
            <Swatch
              key={e.id}
              label={e.label}
              color={e.bgBottom}
              ring={e.transparent ? 'repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 14px 14px' : `linear-gradient(${e.bgTop}, ${e.bgBottom})`}
              active={env === e.id}
              disabled={!canEdit}
              onClick={() => updateBoothStyling({ environment: e.id as EnvironmentId, stylePreset: undefined })}
            />
          ))}
        </Box>
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
        재질·환경은 3D 미리보기와 2D 바닥에 반영됩니다. 환경 <b>Transparent</b>는 PNG 저장 시 배경이 투명해집니다.
      </Typography>
    </Box>
  );
}

/** 체커 스와치용 보조 색(살짝 어둡게) */
function shade(hex: string): string {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map((x) => x + x).join('') : c;
  const n = parseInt(full, 16);
  const r = Math.round(((n >> 16) & 255) * 0.86);
  const g = Math.round(((n >> 8) & 255) * 0.86);
  const b = Math.round((n & 255) * 0.86);
  return `rgb(${r},${g},${b})`;
}

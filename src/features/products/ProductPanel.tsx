import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import type { ProductFacing } from '../../types';
import { useEditor } from '../editor/EditorContext';
import { PRODUCT_FACINGS } from './productModel';

const SCALE_PRESETS = [1, 0.9, 0.8];

/** 배치 제품 선택 패널 — 방향/회전/스케일/교체/복제/삭제 (v0.9.3) */
export default function ProductPanel() {
  const {
    placedProducts,
    selectedProductId,
    products,
    updatePlacedProduct,
    deletePlacedProduct,
    duplicatePlacedProduct,
    replacePlacedProduct,
    replaceProductEverywhere,
    arrangeProductsOnFixture,
  } = useEditor();

  const pp = placedProducts.find((p) => p.id === selectedProductId) ?? null;
  const prod = pp ? products.find((x) => x.id === pp.productId) : null;
  if (!pp || !prod) return null;

  const arrange = (mode: 'center' | 'distributeH' | 'distributeV' | 'front') => {
    if (pp.fixtureId) arrangeProductsOnFixture(pp.fixtureId, mode);
  };

  return (
    <Box sx={{ p: 2, overflowY: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
        {prod.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        {[prod.brand, prod.category].filter(Boolean).join(' · ') || '제품'} · {Math.round(prod.widthMm * pp.scale)}×{Math.round(prod.depthMm * pp.scale)}mm
      </Typography>

      <Divider sx={{ my: 1 }} />

      {/* 진열 방향(Facing) */}
      <Typography variant="caption" color="text.secondary">진열 방향 (Facing)</Typography>
      <ToggleButtonGroup
        exclusive size="small" fullWidth value={pp.facing}
        onChange={(_, v) => v && updatePlacedProduct(pp.id, { facing: v as ProductFacing })}
        sx={{ mb: 1.5, mt: 0.5 }}
      >
        {PRODUCT_FACINGS.map((f) => (
          <ToggleButton key={f.value} value={f.value} sx={{ py: 0.25 }}>{f.label}</ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* 회전 */}
      <Typography variant="caption" color="text.secondary">회전</Typography>
      <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
        {[0, 90, 180, 270].map((deg) => (
          <Button key={deg} size="small" variant={pp.rotationDeg === deg ? 'contained' : 'outlined'} onClick={() => updatePlacedProduct(pp.id, { rotationDeg: deg })} sx={{ minWidth: 0, px: 1, py: 0.25 }}>
            {deg}°
          </Button>
        ))}
        <TextField
          size="small" type="number" value={pp.rotationDeg}
          onChange={(e) => updatePlacedProduct(pp.id, { rotationDeg: ((Math.round(Number(e.target.value)) % 360) + 360) % 360 })}
          sx={{ width: 80 }}
        />
      </Stack>

      {/* 스케일 */}
      <Typography variant="caption" color="text.secondary">크기 {Math.round(pp.scale * 100)}%</Typography>
      <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, mt: 0.5, alignItems: 'center', flexWrap: 'wrap', gap: 0.5 }}>
        {SCALE_PRESETS.map((s) => (
          <Button key={s} size="small" variant={Math.abs(pp.scale - s) < 0.001 ? 'contained' : 'outlined'} onClick={() => updatePlacedProduct(pp.id, { scale: s })} sx={{ minWidth: 0, px: 1, py: 0.25 }}>
            {Math.round(s * 100)}%
          </Button>
        ))}
        <TextField
          size="small" type="number" value={Math.round(pp.scale * 100)}
          onChange={(e) => updatePlacedProduct(pp.id, { scale: Math.max(0.1, (Number(e.target.value) || 100) / 100) })}
          sx={{ width: 80 }}
        />
      </Stack>

      <Divider sx={{ my: 1 }} />

      {/* 집기 위 정렬/균등 배치 (§4, v1.0.0-pre) */}
      <Typography variant="caption" color="text.secondary">집기 위 정렬</Typography>
      {pp.fixtureId ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0.5, mt: 0.5, mb: 1.5 }}>
          <Button size="small" variant="outlined" onClick={() => arrange('center')} sx={{ py: 0.25 }}>가운데 정렬</Button>
          <Button size="small" variant="outlined" onClick={() => arrange('front')} sx={{ py: 0.25 }}>앞쪽 정렬</Button>
          <Button size="small" variant="outlined" onClick={() => arrange('distributeH')} sx={{ py: 0.25 }}>가로 균등</Button>
          <Button size="small" variant="outlined" onClick={() => arrange('distributeV')} sx={{ py: 0.25 }}>세로 균등</Button>
        </Box>
      ) : (
        <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5, mb: 1.5 }}>
          제품이 연결된 집기가 없습니다. 집기를 선택해 제품을 올려주세요.
        </Typography>
      )}

      <Divider sx={{ my: 1 }} />

      {/* Display Lock */}
      <FormControlLabel
        control={<Switch size="small" checked={!!pp.lock} onChange={(e) => updatePlacedProduct(pp.id, { lock: e.target.checked })} />}
        label={<Typography variant="body2">진열 잠금 (이동 금지)</Typography>}
        sx={{ ml: 0, mb: 0.5 }}
      />

      {/* 제품 교체 (위치 유지) */}
      <TextField
        select size="small" fullWidth label="제품 교체 (이 인스턴스)"
        value={pp.productId}
        onChange={(e) => replacePlacedProduct(pp.id, e.target.value)}
        sx={{ mb: 1 }}
      >
        {products.map((x) => <MenuItem key={x.id} value={x.id}>{x.name}</MenuItem>)}
      </TextField>

      <Stack spacing={1}>
        <Button variant="outlined" startIcon={<SwapHorizRoundedIcon />} fullWidth
          onClick={() => {
            const others = products.filter((x) => x.id !== pp.productId);
            if (others.length === 0) return;
            const name = window.prompt(`"${prod.name}"을(를) 어떤 제품으로 전체 교체할까요?\n${others.map((o, i) => `${i + 1}. ${o.name}`).join('\n')}\n번호 입력:`, '1');
            const idx = Number(name) - 1;
            if (idx >= 0 && idx < others.length) replaceProductEverywhere(pp.productId, others[idx].id);
          }}
        >
          이 제품 전체 교체
        </Button>
        <Button variant="outlined" startIcon={<ContentCopyRoundedIcon />} onClick={() => duplicatePlacedProduct(pp.id)} fullWidth>
          복제
        </Button>
        <Button variant="outlined" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={() => deletePlacedProduct(pp.id)} fullWidth>
          삭제
        </Button>
      </Stack>
    </Box>
  );
}

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import InputAdornment from '@mui/material/InputAdornment';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import type { FixtureDef, FixtureShape } from '../../types';
import { useEditor } from './EditorContext';
import { SHAPE_OPTIONS } from '../fixtures/shapes';
import ColorPicker from '../colors/ColorPicker';

/**
 * SVG 변환 집기(배치안 로컬 정의) 편집기.
 *  - 이름/형태/가로/세로/높이/색상/메모 수정 → 즉시 캔버스 반영(localFixture 갱신)
 *  - [집기 라이브러리에 저장]: 전역 FixtureDef 로 등록 (이미 저장 시 비활성)
 *  placedFixture 의 위치는 그대로 유지됩니다(정의만 수정).
 */
export default function ConvertedFixtureEditor({ def }: { def: FixtureDef }) {
  const { updateLocalFixture, saveFixture, fixtures } = useEditor();

  const [name, setName] = useState(def.name);
  const [wStr, setWStr] = useState(String(def.widthMm));
  const [dStr, setDStr] = useState(String(def.depthMm));
  const [hStr, setHStr] = useState(def.heightMm != null ? String(def.heightMm) : '');
  const [memo, setMemo] = useState(def.memo ?? '');
  const [saving, setSaving] = useState(false);

  // 선택 집기가 바뀌면 입력값 동기화
  useEffect(() => {
    setName(def.name);
    setWStr(String(def.widthMm));
    setDStr(String(def.depthMm));
    setHStr(def.heightMm != null ? String(def.heightMm) : '');
    setMemo(def.memo ?? '');
  }, [def.id, def.name, def.widthMm, def.depthMm, def.heightMm, def.memo]);

  const inLibrary = fixtures.some((f) => f.id === def.id);

  const applyNum = (raw: string, key: 'widthMm' | 'depthMm' | 'heightMm') => {
    if (key === 'heightMm' && raw.trim() === '') {
      updateLocalFixture(def.id, { heightMm: undefined });
      return;
    }
    const v = Number(raw);
    if (raw.trim() === '' || Number.isNaN(v) || v < 1) return;
    updateLocalFixture(def.id, { [key]: Math.round(v) });
  };

  const handleSave = async () => {
    if (inLibrary) return;
    setSaving(true);
    try {
      // 현재 편집된 로컬 정의를 그대로 라이브러리에 등록
      await saveFixture({ ...def });
    } finally {
      setSaving(false);
    }
  };

  const mm = <InputAdornment position="end">mm</InputAdornment>;

  return (
    <Box sx={{ mb: 1.5 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1 }}>
        <AutoAwesomeRoundedIcon fontSize="small" color="secondary" />
        <Typography variant="caption" color="secondary" sx={{ fontWeight: 700 }}>
          SVG 변환 집기 — 편집 가능
        </Typography>
      </Stack>

      <TextField
        label="집기명"
        value={name}
        size="small"
        fullWidth
        sx={{ mb: 1 }}
        onChange={(e) => {
          setName(e.target.value);
          updateLocalFixture(def.id, { name: e.target.value });
        }}
      />

      <TextField
        select
        label="형태"
        value={def.shape}
        size="small"
        fullWidth
        sx={{ mb: 1 }}
        onChange={(e) => updateLocalFixture(def.id, { shape: e.target.value as FixtureShape })}
      >
        {SHAPE_OPTIONS.map((o) => (
          <MenuItem key={o.value} value={o.value}>
            {o.label}
          </MenuItem>
        ))}
      </TextField>
      {def.svgPath && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          customPath(SVG 경로) 포함 — 형태를 커스텀 경로로 두면 원래 곡선이 유지됩니다.
        </Typography>
      )}

      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
        <TextField
          label="가로"
          type="number"
          size="small"
          value={wStr}
          onChange={(e) => {
            setWStr(e.target.value);
            applyNum(e.target.value, 'widthMm');
          }}
          slotProps={{ input: { endAdornment: mm } }}
        />
        <TextField
          label="세로"
          type="number"
          size="small"
          value={dStr}
          onChange={(e) => {
            setDStr(e.target.value);
            applyNum(e.target.value, 'depthMm');
          }}
          slotProps={{ input: { endAdornment: mm } }}
        />
      </Stack>

      <TextField
        label="높이"
        type="number"
        size="small"
        value={hStr}
        placeholder="선택"
        onChange={(e) => {
          setHStr(e.target.value);
          applyNum(e.target.value, 'heightMm');
        }}
        slotProps={{ input: { endAdornment: mm } }}
        fullWidth
        sx={{ mb: 1 }}
      />

      {/* 색상 (고급 색상 선택기) */}
      <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
          색상
        </Typography>
        <ColorPicker
          color={def.color}
          opacity={def.opacity ?? 1}
          onChange={(c, o) => updateLocalFixture(def.id, { color: c, opacity: o })}
        />
      </Box>

      <TextField
        label="메모"
        value={memo}
        size="small"
        fullWidth
        multiline
        minRows={1}
        sx={{ mb: 1 }}
        onChange={(e) => {
          setMemo(e.target.value);
          updateLocalFixture(def.id, { memo: e.target.value });
        }}
      />

      {inLibrary ? (
        <Chip
          size="small"
          color="success"
          variant="outlined"
          icon={<CheckCircleRoundedIcon />}
          label="이미 라이브러리에 저장됨"
          sx={{ alignSelf: 'flex-start' }}
        />
      ) : (
        <Button
          variant="contained"
          color="secondary"
          size="small"
          startIcon={<SaveRoundedIcon />}
          onClick={handleSave}
          disabled={saving}
          fullWidth
        >
          집기 라이브러리에 저장
        </Button>
      )}

      <Divider sx={{ my: 1.5 }} />
    </Box>
  );
}

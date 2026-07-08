import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import {
  getRecentColors,
  addRecentColor,
  isValidHex,
  normalizeHex,
  hexToRgba,
} from './palette';

/**
 * 색상 선택기 (v0.8.5, v1.0.5 단순화).
 * 순서: 최근 사용 → HEX → Color Picker → Opacity. (브랜드 컬러/기본 팔레트 UI 제거)
 */
export default function ColorPicker({
  color,
  opacity = 1,
  onChange,
  showOpacity = true,
}: {
  color: string;
  opacity?: number;
  onChange: (color: string, opacity: number) => void;
  showOpacity?: boolean;
}) {
  const [hexInput, setHexInput] = useState((normalizeHex(color) ?? color).toUpperCase());
  const [hexError, setHexError] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    setRecent(getRecentColors());
  }, []);

  // 외부에서 color 가 바뀌면 입력창 동기화
  useEffect(() => {
    setHexInput((normalizeHex(color) ?? color).toUpperCase());
    setHexError(false);
  }, [color]);

  const applyColor = (hex: string, commitRecent = false) => {
    const norm = normalizeHex(hex);
    if (!norm) return;
    onChange(norm, opacity);
    if (commitRecent) setRecent(addRecentColor(norm));
  };

  const onHexChange = (raw: string) => {
    setHexInput(raw.toUpperCase());
    const norm = normalizeHex(raw);
    if (norm) {
      setHexError(false);
      onChange(norm, opacity); // 유효하면 즉시 반영(최근목록은 blur/Enter 시)
    } else {
      setHexError(raw.trim().length > 0);
    }
  };

  const commitHex = () => {
    if (isValidHex(hexInput)) applyColor(hexInput, true);
  };

  const currentHex = normalizeHex(color) ?? '#000000';

  const Swatch = ({ c, label }: { c: string; label: string }) => (
    <Tooltip title={label} arrow>
      <Box
        role="button"
        aria-label={label}
        onClick={() => applyColor(c, true)}
        sx={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          bgcolor: c,
          cursor: 'pointer',
          border: '1px solid rgba(0,0,0,0.25)',
          outline: currentHex.toUpperCase() === c.toUpperCase() ? '2px solid' : 'none',
          outlineColor: 'primary.main',
          outlineOffset: 1,
          transition: 'transform 0.1s',
          '&:hover': { transform: 'scale(1.12)' },
        }}
      />
    </Tooltip>
  );

  return (
    <Stack spacing={1.25}>
      {/* 최근 사용 */}
      <Box>
        <Label>최근 사용</Label>
        {recent.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {recent.map((c) => (
              <Swatch key={c} c={c} label={c} />
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            아직 없습니다.
          </Typography>
        )}
      </Box>

      {/* HEX + Color Picker */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
        <TextField
          label="HEX"
          size="small"
          value={hexInput}
          error={hexError}
          helperText={hexError ? '올바른 HEX 형식이 아닙니다.' : ' '}
          onChange={(e) => onHexChange(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => e.key === 'Enter' && commitHex()}
          sx={{ width: 130 }}
        />
        <Box sx={{ pt: 0.5 }}>
          <input
            type="color"
            aria-label="색상 선택기"
            value={currentHex}
            onChange={(e) => onChange(e.target.value.toUpperCase(), opacity)}
            onBlur={(e) => applyColor(e.target.value, true)}
            style={{ width: 40, height: 34, border: 'none', background: 'none', cursor: 'pointer' }}
          />
        </Box>
        {/* 미리보기 (opacity 반영) */}
        <Box
          sx={{
            width: 34,
            height: 34,
            mt: 0.5,
            borderRadius: 1,
            border: '1px solid rgba(0,0,0,0.2)',
            background:
              'linear-gradient(45deg,#ddd 25%,transparent 25%,transparent 75%,#ddd 75%),linear-gradient(45deg,#ddd 25%,#fff 25%,#fff 75%,#ddd 75%)',
            backgroundSize: '10px 10px',
            backgroundPosition: '0 0, 5px 5px',
          }}
        >
          <Box sx={{ width: '100%', height: '100%', borderRadius: 1, bgcolor: hexToRgba(currentHex, opacity) }} />
        </Box>
      </Stack>

      {/* Opacity */}
      {showOpacity && (
        <Box>
          <Label>투명도 {Math.round(opacity * 100)}%</Label>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.05}
            value={opacity}
            onChange={(_, v) => onChange(currentHex, v as number)}
            sx={{ maxWidth: 260 }}
          />
        </Box>
      )}
    </Stack>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>
      {children}
    </Typography>
  );
}

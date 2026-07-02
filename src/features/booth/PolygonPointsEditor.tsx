import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';

/** 폼 편집용 꼭짓점(문자열로 보관해 입력 중 빈값 허용) */
export interface PointInput {
  x: string;
  y: string;
}

interface PolygonPointsEditorProps {
  points: PointInput[];
  onChange: (points: PointInput[]) => void;
  error?: string;
}

/**
 * 다각형 부스 꼭짓점 표 편집기.
 * xMm/yMm 직접 입력, 꼭짓점 추가/삭제. (드래그 편집은 이후 단계)
 */
export default function PolygonPointsEditor({
  points,
  onChange,
  error,
}: PolygonPointsEditorProps) {
  const update = (i: number, key: 'x' | 'y', value: string) => {
    onChange(points.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)));
  };

  const addPoint = () => {
    // 마지막 점 근처에 새 점 추가
    const last = points[points.length - 1] ?? { x: '0', y: '0' };
    onChange([...points, { x: last.x, y: last.y }]);
  };

  const removePoint = (i: number) => {
    onChange(points.filter((_, idx) => idx !== i));
  };

  return (
    <Box>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          꼭짓점 좌표 (mm)
        </Typography>
        <Button size="small" startIcon={<AddRoundedIcon />} onClick={addPoint}>
          꼭짓점 추가
        </Button>
      </Stack>

      <Stack spacing={1}>
        {points.map((p, i) => (
          <Stack key={i} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography
              variant="caption"
              sx={{ width: 28, color: 'text.secondary', fontWeight: 700 }}
            >
              P{i + 1}
            </Typography>
            <TextField
              label="X"
              type="number"
              size="small"
              value={p.x}
              onChange={(e) => update(i, 'x', e.target.value)}
              slotProps={{ input: { endAdornment: <Typography variant="caption">mm</Typography> } }}
            />
            <TextField
              label="Y"
              type="number"
              size="small"
              value={p.y}
              onChange={(e) => update(i, 'y', e.target.value)}
              slotProps={{ input: { endAdornment: <Typography variant="caption">mm</Typography> } }}
            />
            <Tooltip title="꼭짓점 삭제">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => removePoint(i)}
                  disabled={points.length <= 3}
                >
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        ))}
      </Stack>

      {error && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>
          {error}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        최소 3개 꼭짓점이 필요합니다. 좌표는 좌상단(0,0) 기준 mm 입니다.
      </Typography>
    </Box>
  );
}

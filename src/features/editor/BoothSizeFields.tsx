import { useEffect, useState, type KeyboardEvent } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import { useEditor } from './EditorContext';

/**
 * 부스 크기(가로·세로·높이) 인라인 편집 (v1.2.1).
 * 상단 정보 바에서 직접 수정. Enter=적용, Escape=취소(원복). 자동저장 + Undo/Redo(히스토리 반영).
 * 다각형 부스는 bbox 라 직접 입력을 비활성(부스 편집 사용 안내).
 */
export default function BoothSizeFields() {
  const { project, updateBoothSize } = useEditor();
  const bc = project?.boothConfig;
  const isPolygon = bc?.boothShape === 'polygon';

  const [w, setW] = useState('');
  const [d, setD] = useState('');
  const [h, setH] = useState('');

  const sync = () => {
    if (!bc) return;
    setW(String(bc.widthMm));
    setD(String(bc.depthMm));
    setH(bc.heightMm == null ? '' : String(bc.heightMm));
  };
  useEffect(() => {
    sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bc?.widthMm, bc?.depthMm, bc?.heightMm]);

  const commitW = () => { const n = Number(w); if (n >= 100) updateBoothSize({ widthMm: n }); else setW(String(bc?.widthMm ?? '')); };
  const commitD = () => { const n = Number(d); if (n >= 100) updateBoothSize({ depthMm: n }); else setD(String(bc?.depthMm ?? '')); };
  const commitH = () => {
    if (h.trim() === '') { updateBoothSize({ heightMm: null }); return; }
    const n = Number(h);
    if (n >= 100) updateBoothSize({ heightMm: n }); else setH(bc?.heightMm == null ? '' : String(bc.heightMm));
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>, commit: () => void) => {
    if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); commit(); }
    else if (e.key === 'Escape') { sync(); (e.target as HTMLInputElement).blur(); }
  };

  const mm = { endAdornment: <Typography variant="caption" color="text.secondary">mm</Typography> };
  const field = (label: string, val: string, setVal: (v: string) => void, commit: () => void) => (
    <TextField
      size="small"
      label={label}
      type="number"
      value={val}
      disabled={isPolygon}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => onKey(e, commit)}
      slotProps={{ input: mm, htmlInput: { min: 100, step: 10, 'aria-label': `부스 ${label}` } }}
      sx={{ width: 104 }}
    />
  );

  const fields = (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
      {field('가로', w, setW, commitW)}
      {field('세로', d, setD, commitD)}
      {field('높이', h, setH, commitH)}
    </Stack>
  );

  if (isPolygon) {
    return (
      <Tooltip title="다각형 부스는 '부스 편집'(꼭짓점 드래그)에서 형태를 조절하세요">
        <span>{fields}</span>
      </Tooltip>
    );
  }
  return fields;
}

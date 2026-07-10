import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEditor } from './EditorContext';

/**
 * 부스 크기(가로·세로·높이) 인라인 편집 (v1.2.1, v1.2.2).
 * 상단 정보 바에서 직접 수정. Enter=적용, Escape=취소(원복). 자동저장 + Undo/Redo(히스토리 반영).
 * 사각형은 직접, 다각형은 형태 유지하며 bbox 비례 스케일(모두 편집 가능).
 */
export default function BoothSizeFields() {
  const { project, updateBoothSize } = useEditor();
  const bc = project?.boothConfig;
  const isPolygon = bc?.boothShape === 'polygon';

  const [w, setW] = useState('');
  const [d, setD] = useState('');
  const [h, setH] = useState('');
  // 편집 중(포커스)인 필드가 있으면 boothConfig 변화로 인한 재동기화를 건너뛴다
  // → 한 필드 커밋이 편집 중인 다른 필드 값을 덮어쓰지 않음.
  const focused = useRef(false);

  const sync = () => {
    if (!bc) return;
    setW(String(bc.widthMm));
    setD(String(bc.depthMm));
    setH(bc.heightMm == null ? '' : String(bc.heightMm));
  };
  useEffect(() => {
    if (focused.current) return; // 편집 중이면 스킵
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
      onChange={(e) => setVal(e.target.value)}
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; commit(); }}
      onKeyDown={(e) => onKey(e, commit)}
      slotProps={{ input: mm, htmlInput: { min: 100, step: 10, 'aria-label': `부스 ${label}` } }}
      sx={{ width: 104 }}
    />
  );

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
      {field('가로', w, setW, commitW)}
      {field('세로', d, setD, commitD)}
      {field('높이', h, setH, commitH)}
      {isPolygon && (
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 160 }}>
          다각형은 형태 유지하며 비례 조절
        </Typography>
      )}
    </Stack>
  );
}

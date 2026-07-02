import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Alert from '@mui/material/Alert';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import { useEditor } from './EditorContext';
import {
  countElements,
  isLikelyBackgroundElement,
  SVG_ELEMENT_TYPES,
  SVG_ELEMENT_LABEL,
} from '../svg/SvgModel';

/**
 * SVG Inspector — 선택된 SvgDocument 의 내부 구조를 검사(읽기)합니다.
 * 요소 타입별 개수 + 총 개수를 보여주고, 목록에서 도형을 클릭하면
 * Canvas 에서 해당 도형이 하이라이트됩니다. (편집 없음)
 */
export default function SvgInspectorPanel() {
  const {
    selectedSvgDocument: doc,
    selectedSvgElementId,
    setSelectedSvgElementId,
    convertSvgElementToFixture,
    deleteSelected,
  } = useEditor();

  if (!doc) return null;
  const counts = countElements(doc);
  const selectedEl = selectedSvgElementId ? doc.elements.find((e) => e.id === selectedSvgElementId) ?? null : null;
  const canConvert = !!selectedEl && selectedEl.type !== 'text' && !selectedEl.converted;
  const isBackground = !!selectedEl && isLikelyBackgroundElement(selectedEl);
  const convertHint =
    selectedEl?.type === 'line'
      ? '선(line)은 치수선으로 변환됩니다.'
      : '선택 도형을 집기로 변환합니다. (라이브러리 저장 안 함)';

  const handleConvert = () => {
    if (!canConvert || !selectedEl) return;
    if (
      isBackground &&
      !window.confirm(
        '이 도형은 배경/아트보드로 추정됩니다(문서의 80% 이상 차지).\n그래도 집기로 변환할까요?',
      )
    ) {
      return;
    }
    convertSvgElementToFixture(doc.id, selectedEl.id);
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
        SVG 검사기
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap title={doc.name}>
        {doc.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
        {Math.round(doc.viewBox.width)} × {Math.round(doc.viewBox.height)} (viewBox)
      </Typography>

      <Divider sx={{ my: 1 }} />

      {/* 타입별 개수 */}
      <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
        {SVG_ELEMENT_TYPES.filter((t) => counts.byType[t] > 0).map((t) => (
          <Chip
            key={t}
            size="small"
            variant="outlined"
            label={`${SVG_ELEMENT_LABEL[t]} : ${counts.byType[t]}`}
          />
        ))}
        {counts.total === 0 && (
          <Typography variant="body2" color="text.secondary">
            읽을 수 있는 도형이 없습니다.
          </Typography>
        )}
      </Stack>
      <Typography variant="body2" sx={{ fontWeight: 800, mb: 1 }}>
        총 객체 : {counts.total}
      </Typography>

      <Divider sx={{ my: 1 }} />

      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
        도형을 클릭하면 캔버스에서 하이라이트됩니다.
      </Typography>

      {/* 도형 목록 */}
      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
        <List dense disablePadding>
          {doc.elements.map((el, idx) => (
            <ListItemButton
              key={el.id}
              selected={el.id === selectedSvgElementId}
              onClick={() =>
                setSelectedSvgElementId(el.id === selectedSvgElementId ? null : el.id)
              }
            >
              <ListItemText
                primary={`${idx + 1}. ${SVG_ELEMENT_LABEL[el.type]}`}
                secondary={el.type === 'text' ? el.text || '(빈 텍스트)' : undefined}
                slotProps={{
                  primary: { variant: 'body2' },
                  secondary: { variant: 'caption', noWrap: true },
                }}
              />
              {el.converted && (
                <Chip
                  size="small"
                  color="success"
                  variant="outlined"
                  icon={<CheckCircleRoundedIcon />}
                  label="Converted"
                  sx={{ ml: 1 }}
                />
              )}
            </ListItemButton>
          ))}
        </List>
      </Box>

      <Divider sx={{ my: 1 }} />

      {/* 집기로 변환 (도형 선택 시) */}
      {selectedEl && (
        <>
          {selectedEl.converted ? (
            <Chip
              size="small"
              color="success"
              variant="outlined"
              icon={<CheckCircleRoundedIcon />}
              label={`${SVG_ELEMENT_LABEL[selectedEl.type]} 변환 완료`}
              sx={{ alignSelf: 'flex-start', mb: 1 }}
            />
          ) : selectedEl.type === 'text' ? (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
              텍스트(text)는 아직 변환할 수 없습니다.
            </Typography>
          ) : (
            <>
              {isBackground && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  배경/아트보드로 추정되는 큰 도형입니다(문서의 80% 이상). 변환 시 확인을 거칩니다.
                </Alert>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                {convertHint}
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={<CategoryRoundedIcon />}
                onClick={handleConvert}
                fullWidth
                sx={{ mb: 1 }}
              >
                집기로 변환
              </Button>
            </>
          )}
        </>
      )}

      <Button
        variant="outlined"
        color="error"
        size="small"
        startIcon={<DeleteOutlineRoundedIcon />}
        onClick={deleteSelected}
        fullWidth
      >
        SVG 객체 삭제
      </Button>
    </Box>
  );
}

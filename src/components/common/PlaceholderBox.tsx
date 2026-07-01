import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { ReactNode } from 'react';

interface PlaceholderBoxProps {
  /** 영역 제목 (예: "집기 라이브러리") */
  title: string;
  /** 보조 설명 (예: "5단계에서 구현됩니다") */
  description?: string;
  icon?: ReactNode;
}

/**
 * 아직 구현되지 않은 영역을 나타내는 재사용 플레이스홀더.
 * 점선 테두리 + 제목 + 안내 문구로 "여기에 무엇이 올지"를 보여줍니다.
 */
export default function PlaceholderBox({
  title,
  description,
  icon,
}: PlaceholderBoxProps) {
  return (
    <Box
      sx={{
        height: '100%',
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        p: 2,
        textAlign: 'center',
        border: '2px dashed',
        borderColor: 'divider',
        borderRadius: 2,
        color: 'text.secondary',
        bgcolor: 'action.hover',
      }}
    >
      {icon}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 260 }}>
          {description}
        </Typography>
      )}
    </Box>
  );
}

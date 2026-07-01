import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import AppHeader from './AppHeader';

interface AppLayoutProps {
  /** 왼쪽 사이드바 영역 (없으면 렌더링하지 않음) */
  leftSidebar?: ReactNode;
  /** 오른쪽 정보 패널 영역 (없으면 렌더링하지 않음) */
  rightPanel?: ReactNode;
  /** 메인 콘텐츠 */
  children: ReactNode;
  /** 메인 영역 좌우 패딩 사용 여부 (편집기 캔버스는 false 로 꽉 채움) */
  padded?: boolean;
}

const LEFT_WIDTH = 240;
const RIGHT_WIDTH = 300;

/**
 * 앱 전체 레이아웃 셸.
 *
 * 구조: [상단 헤더] + [왼쪽 사이드바 | 메인 | 오른쪽 정보 패널]
 * 각 사이드/패널 영역은 슬롯(prop)으로 주입하므로 페이지마다 다르게 재사용됩니다.
 *   - 일반 페이지: leftSidebar = 네비게이션
 *   - 편집기: leftSidebar = 집기 라이브러리, rightPanel = 선택 정보
 */
export default function AppLayout({
  leftSidebar,
  rightPanel,
  children,
  padded = true,
}: AppLayoutProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppHeader />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {leftSidebar && (
          <Box
            component="aside"
            sx={{
              width: LEFT_WIDTH,
              flexShrink: 0,
              borderRight: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflowY: 'auto',
            }}
          >
            {leftSidebar}
          </Box>
        )}

        <Box
          component="main"
          sx={{
            flex: 1,
            minWidth: 0,
            overflowY: 'auto',
            p: padded ? 3 : 0,
          }}
        >
          {children}
        </Box>

        {rightPanel && (
          <Box
            component="aside"
            sx={{
              width: RIGHT_WIDTH,
              flexShrink: 0,
              borderLeft: '1px solid',
              borderColor: 'divider',
              bgcolor: 'background.paper',
              overflowY: 'auto',
            }}
          >
            {rightPanel}
          </Box>
        )}
      </Box>
    </Box>
  );
}

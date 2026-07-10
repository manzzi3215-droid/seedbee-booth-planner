import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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

const LEFT_WIDTH = 260;
const RIGHT_WIDTH = 320;
const MIN_WIDTH = 200;
const MAX_WIDTH = 560;

function clampW(w: number) {
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w));
}
function readW(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return v ? clampW(v) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 크기 조절 가능한 사이드 패널 (v1.0.2 §6).
 * 드래그 핸들로 너비 조절 · localStorage 에 마지막 크기 저장 · 더블클릭 시 기본폭 복원.
 */
function ResizableAside({
  side,
  storageKey,
  defaultWidth,
  children,
}: {
  side: 'left' | 'right';
  storageKey: string;
  defaultWidth: number;
  children: ReactNode;
}) {
  const [width, setWidth] = useState(() => readW(storageKey, defaultWidth));
  const [active, setActive] = useState(false); // 드래그 중 Divider 하이라이트
  const dragging = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(width));
    } catch {
      /* 무시 */
    }
  }, [storageKey, width]);

  // 화면이 작아지면 패널 폭 자동 보정 (메인 영역 최소 공간 확보)
  useEffect(() => {
    const onResize = () => {
      const avail = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, window.innerWidth - 360));
      setWidth((w) => Math.min(w, avail));
    };
    window.addEventListener('resize', onResize);
    onResize();
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      setActive(true);
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = side === 'left' ? ev.clientX - startX : startX - ev.clientX;
        setWidth(clampW(startW + delta));
      };
      const onUp = () => {
        dragging.current = false;
        setActive(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [side, width],
  );

  // VSCode/Figma 스타일 리사이즈 핸들: 넓은 히트영역 + 가운데 얇은 라인, hover/drag 시 강조
  const handle = (
    <Box
      onMouseDown={onMouseDown}
      onDoubleClick={() => setWidth(defaultWidth)}
      title="드래그로 너비 조절 · 더블클릭 시 기본폭"
      sx={{
        width: 10,
        flexShrink: 0,
        cursor: 'col-resize',
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        // 가운데 얇은 라인(항상 은은히 보임 → 발견성) + hover/drag 강조
        '&::after': {
          content: '""',
          width: active ? '3px' : '1.5px',
          height: '100%',
          bgcolor: active ? 'primary.main' : 'divider',
          transition: 'background-color 0.12s, width 0.12s',
        },
        '&:hover::after': { bgcolor: 'primary.main', width: '3px' },
      }}
    />
  );

  const panel = (
    <Box
      component="aside"
      sx={{
        width,
        flexShrink: 0,
        [side === 'left' ? 'borderRight' : 'borderLeft']: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflowY: 'auto',
      }}
    >
      {children}
    </Box>
  );

  return side === 'left' ? (
    <>
      {panel}
      {handle}
    </>
  ) : (
    <>
      {handle}
      {panel}
    </>
  );
}

/**
 * 앱 전체 레이아웃 셸.
 *
 * 구조: [상단 헤더] + [왼쪽 사이드바 | 메인 | 오른쪽 정보 패널]
 * 사이드 패널은 크기 조절 가능(v1.0.2). 페이지마다 슬롯(prop)으로 주입해 재사용합니다.
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
          <ResizableAside side="left" storageKey="blp:leftPanelWidth" defaultWidth={LEFT_WIDTH}>
            {leftSidebar}
          </ResizableAside>
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
          <ResizableAside side="right" storageKey="blp:rightPanelWidth" defaultWidth={RIGHT_WIDTH}>
            {rightPanel}
          </ResizableAside>
        )}
      </Box>
    </Box>
  );
}

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';

/**
 * 중앙 작업 영역 세로 스플릿 (v1.2.0).
 * 상단 클러스터(부스 정보·힌트·툴바)와 메인 캔버스 사이에 가로 Divider 를 두어
 * 상단 영역의 높이를 위·아래 드래그로 조절한다 (VSCode 하단 패널 스타일).
 *  - 위로 드래그 → 상단이 작아지고 캔버스가 커짐
 *  - 아래로 드래그 → 상단이 커지고 캔버스가 작아짐
 * 높이는 localStorage 에 저장(패널별 key). 더블클릭 시 기본(자연 높이)로 복원.
 * 화면이 작아지면 자동 clamp. 캔버스는 flex 로 남은 공간을 채우며 ResizeObserver 로 즉시 갱신됨.
 */

const RESET_EVENT = 'blp:resetCenterLayout';

/** 외부(설정/커맨드)에서 중앙 레이아웃 초기화를 트리거 */
export function resetCenterLayout() {
  window.dispatchEvent(new CustomEvent(RESET_EVENT));
}

export default function ResizableSplit({
  storageKey,
  topSlot,
  canvasSlot,
  minTop = 96,
  minCanvas = 300,
}: {
  storageKey: string;
  topSlot: ReactNode;
  canvasSlot: ReactNode;
  minTop?: number;
  minCanvas?: number;
}) {
  // null = 자연 높이(미조절). 숫자 = 사용자 지정 높이(px).
  const [topH, setTopH] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(storageKey);
      return v == null || v === '' ? null : Number(v);
    } catch {
      return null;
    }
  });
  const [active, setActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  // 저장
  useEffect(() => {
    try {
      if (topH == null) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, String(Math.round(topH)));
    } catch {
      /* 무시 */
    }
  }, [storageKey, topH]);

  // 화면 크기 변경 시 자동 clamp (저장값이 남은 공간을 넘지 않도록)
  useEffect(() => {
    const onResize = () => {
      const cont = containerRef.current;
      if (!cont) return;
      const maxTop = Math.max(minTop, cont.clientHeight - minCanvas);
      setTopH((h) => (h == null ? null : Math.min(Math.max(h, minTop), maxTop)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [minTop, minCanvas]);

  // 외부 초기화 이벤트 (설정 다이얼로그의 '중앙 패널 배치 초기화')
  useEffect(() => {
    const onReset = () => setTopH(null);
    window.addEventListener(RESET_EVENT, onReset);
    return () => window.removeEventListener(RESET_EVENT, onReset);
  }, []);

  const clampTop = (h: number) => {
    const cont = containerRef.current;
    const maxTop = cont ? Math.max(minTop, cont.clientHeight - minCanvas) : h;
    return Math.min(Math.max(h, minTop), maxTop);
  };

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      setActive(true);
      const startY = e.clientY;
      const startH = topRef.current?.offsetHeight ?? 200;
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        setTopH(clampTop(startH + (ev.clientY - startY)));
      };
      const onUp = () => {
        dragging.current = false;
        setActive(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minTop, minCanvas],
  );

  // 키보드 접근성: 포커스 후 방향키로 높이 조절
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 12;
    const base = topRef.current?.offsetHeight ?? 200;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTopH(clampTop(base - step));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setTopH(clampTop(base + step));
    }
  };

  return (
    <Box ref={containerRef} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box
        ref={topRef}
        sx={{
          height: topH == null ? 'auto' : topH,
          flexShrink: 0,
          overflow: topH == null ? 'visible' : 'auto',
        }}
      >
        {topSlot}
      </Box>

      {/* 가로 Divider — 위·아래 드래그로 상단 높이 조절 */}
      <Box
        role="separator"
        aria-orientation="horizontal"
        aria-label="상단 영역 높이 조절 (더블클릭: 기본값)"
        tabIndex={0}
        onMouseDown={onMouseDown}
        onDoubleClick={() => setTopH(null)}
        onKeyDown={onKeyDown}
        title="드래그로 높이 조절 · 더블클릭 시 기본 높이"
        sx={{
          height: 10,
          flexShrink: 0,
          cursor: 'row-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&::after': {
            content: '""',
            height: active ? '3px' : '1.5px',
            width: '100%',
            bgcolor: active ? 'primary.main' : 'divider',
            transition: 'background-color 0.12s, height 0.12s',
          },
          '&:hover::after': { bgcolor: 'primary.main', height: '3px' },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
        }}
      />

      {/* 캔버스 영역: 절대배치 내부 래퍼로 자식(height:100% 캔버스)의 퍼센트 높이를 확실히 해석 */}
      <Box sx={{ flex: 1, minHeight: minCanvas, position: 'relative' }}>
        <Box sx={{ position: 'absolute', inset: 0 }}>{canvasSlot}</Box>
      </Box>
    </Box>
  );
}

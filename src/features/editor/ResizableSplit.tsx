import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

/**
 * 중앙 작업영역 세로 스플릿 (v1.2.1).
 * 상단 클러스터(툴바 + 부스 정보)와 메인 캔버스 사이에 가로 Divider 를 두고,
 * flex column 레이아웃에서 상단의 실제 높이(px)를 조절한다.
 *  - 상단 = height(px) 고정 flex item / 캔버스 = flex:1 로 남은 공간
 *  - Divider 를 위·아래 드래그 → 상단 높이 변경 → 캔버스 시작 위치가 함께 이동(겹침 없음)
 *  - 접기(collapse): 상단을 최소 높이로 / 펼치기: 마지막 높이 복원
 * 높이·접힘 상태는 localStorage 저장(드래그 종료 시). 더블클릭 시 기본(자연 높이) 복원.
 * 캔버스는 flex 로 리사이즈되며 자식(BoothCanvas)의 ResizeObserver 가 Stage 를 즉시 갱신한다.
 */

const RESET_EVENT = 'blp:resetCenterLayout';
const TOGGLE_EVENT = 'blp:toggleWorkspace';

/** 외부(설정)에서 중앙 레이아웃 초기화 */
export function resetCenterLayout() {
  window.dispatchEvent(new CustomEvent(RESET_EVENT));
}
/** 외부(툴바 '작업 공간 확장')에서 상단 접기/펼치기 토글 */
export function toggleWorkspaceExpand() {
  window.dispatchEvent(new CustomEvent(TOGGLE_EVENT));
}

export default function ResizableSplit({
  storageKey,
  topSlot,
  canvasSlot,
  minTop = 120,
  minCanvas = 300,
}: {
  storageKey: string;
  topSlot: ReactNode;
  canvasSlot: ReactNode;
  minTop?: number;
  minCanvas?: number;
}) {
  const heightKey = storageKey;
  const collapseKey = `${storageKey}:collapsed`;

  const [topH, setTopH] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(heightKey);
      return v == null || v === '' ? null : Number(v);
    } catch {
      return null;
    }
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(collapseKey) === '1';
    } catch {
      return false;
    }
  });
  const [active, setActive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const lastExpanded = useRef<number | null>(topH);
  const dragging = useRef(false);
  const raf = useRef<number | null>(null);

  const persistH = (h: number | null) => {
    try {
      if (h == null) localStorage.removeItem(heightKey);
      else localStorage.setItem(heightKey, String(Math.round(h)));
    } catch { /* 무시 */ }
  };
  const persistCollapsed = (c: boolean) => {
    try { localStorage.setItem(collapseKey, c ? '1' : '0'); } catch { /* 무시 */ }
  };

  const clampTop = useCallback((h: number) => {
    const cont = containerRef.current;
    const maxTop = cont ? Math.max(minTop, cont.clientHeight - minCanvas) : h;
    return Math.min(Math.max(h, minTop), maxTop);
  }, [minTop, minCanvas]);

  // 화면 크기 변경 시 자동 clamp
  useEffect(() => {
    const onResize = () => {
      setTopH((h) => (h == null ? null : clampTop(h)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampTop]);

  // 외부 이벤트: 초기화 / 작업공간 토글
  useEffect(() => {
    const onReset = () => { setCollapsed(false); persistCollapsed(false); setTopH(null); persistH(null); };
    const onToggle = () => toggleCollapse();
    window.addEventListener(RESET_EVENT, onReset);
    window.addEventListener(TOGGLE_EVENT, onToggle);
    return () => {
      window.removeEventListener(RESET_EVENT, onReset);
      window.removeEventListener(TOGGLE_EVENT, onToggle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      if (next) {
        lastExpanded.current = topRef.current?.offsetHeight ?? topH;
      } else if (lastExpanded.current != null) {
        const h = clampTop(lastExpanded.current);
        setTopH(h);
        persistH(h);
      }
      persistCollapsed(next);
      return next;
    });
  };

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (collapsed) { setCollapsed(false); persistCollapsed(false); }
    dragging.current = true;
    setActive(true);
    const startY = e.clientY;
    const startH = topRef.current?.offsetHeight ?? 200;
    let latest = startH;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      latest = clampTop(startH + (ev.clientY - startY));
      if (raf.current == null) {
        raf.current = requestAnimationFrame(() => {
          raf.current = null;
          setTopH(latest);
        });
      }
    };
    const onUp = () => {
      dragging.current = false;
      setActive(false);
      if (raf.current != null) { cancelAnimationFrame(raf.current); raf.current = null; }
      setTopH(latest);
      persistH(latest); // 저장은 드래그 종료 시에만
      lastExpanded.current = latest;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [collapsed, clampTop]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 12;
    const base = topRef.current?.offsetHeight ?? 200;
    if (e.key === 'ArrowUp') { e.preventDefault(); const h = clampTop(base - step); setTopH(h); persistH(h); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const h = clampTop(base + step); setTopH(h); persistH(h); }
  };

  // 접힘 = 상단 완전 최소화(0, 캔버스 최대). 드래그 = minTop 까지(툴바 유지). 미조절 = 자연 높이.
  const effectiveHeight = collapsed ? 0 : (topH == null ? 'auto' : topH);
  const isConstrained = topH != null;

  return (
    <Box ref={containerRef} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* 상단 클러스터 — 실제 flex 높이. 넘치면 내부 스크롤(툴바가 맨 위라 항상 보임). 접힘 시 0 */}
      <Box
        ref={topRef}
        sx={{
          height: effectiveHeight,
          flexShrink: 0,
          overflowY: collapsed ? 'hidden' : (isConstrained ? 'auto' : 'visible'),
          overflowX: 'visible',
        }}
      >
        {topSlot}
      </Box>

      {/* 가로 Divider + 접기/펼치기 버튼 */}
      <Box
        sx={{
          position: 'relative',
          height: 12,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          role="separator"
          aria-orientation="horizontal"
          aria-label="상단 영역 높이 조절 (더블클릭: 기본값)"
          tabIndex={0}
          onMouseDown={onMouseDown}
          onDoubleClick={() => { setCollapsed(false); persistCollapsed(false); setTopH(null); persistH(null); }}
          onKeyDown={onKeyDown}
          title="드래그로 높이 조절 · 더블클릭: 기본 높이"
          sx={{
            position: 'absolute',
            inset: 0,
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
        <Tooltip title={collapsed ? '상단 영역 펼치기' : '상단 영역 접기(작업공간 확장)'}>
          <IconButton
            size="small"
            onClick={toggleCollapse}
            sx={{
              position: 'absolute',
              right: 8,
              zIndex: 1,
              width: 22,
              height: 22,
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            {collapsed ? <KeyboardArrowDownRoundedIcon sx={{ fontSize: 16 }} /> : <KeyboardArrowUpRoundedIcon sx={{ fontSize: 16 }} />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* 캔버스 — 절대배치 래퍼로 자식(height:100%)의 퍼센트 높이 해석 보장 */}
      <Box sx={{ flex: 1, minHeight: minCanvas, position: 'relative' }}>
        <Box sx={{ position: 'absolute', inset: 0 }}>{canvasSlot}</Box>
      </Box>
    </Box>
  );
}

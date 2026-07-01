import { useEffect, useRef, useState } from 'react';

export interface Size {
  width: number;
  height: number;
}

/**
 * 대상 요소의 실제 픽셀 크기를 ResizeObserver 로 추적하는 훅.
 * 캔버스 Stage 크기를 컨테이너에 맞추는 데 사용합니다.
 */
export function useContainerSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

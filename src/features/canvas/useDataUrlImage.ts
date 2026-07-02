import { useEffect, useState } from 'react';

/**
 * 여러 이미지 dataURL 을 HTMLImageElement 로 로드해 Map 으로 반환하는 훅.
 *
 * ⚠️ 이 훅은 캔버스 컴포넌트(BoothCanvas/WallCanvas, React DOM 트리)에서 호출합니다.
 * Konva Stage 자식(ImageNode) 안에서 훅을 쓰면 react-konva 리컨실러와 충돌하여
 * "Invalid hook call" 이 발생하므로, 이미지 로드는 캔버스 레벨에서 처리합니다.
 */
export function useImageMap(srcs: string[]): Map<string, HTMLImageElement> {
  const [map, setMap] = useState<Map<string, HTMLImageElement>>(new Map());
  const key = srcs.join('|');

  useEffect(() => {
    let active = true;
    const missing = srcs.filter((s) => s && !map.has(s));
    if (missing.length === 0) return;
    Promise.all(
      missing.map(
        (s) =>
          new Promise<[string, HTMLImageElement]>((resolve) => {
            const img = new Image();
            img.onload = () => resolve([s, img]);
            img.onerror = () => resolve([s, img]);
            img.src = s;
          }),
      ),
    ).then((pairs) => {
      if (!active) return;
      setMap((prev) => {
        const next = new Map(prev);
        for (const [s, el] of pairs) next.set(s, el);
        return next;
      });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}

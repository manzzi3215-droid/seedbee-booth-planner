import { useEffect, useState } from 'react';

/**
 * dataURL(또는 URL) 문자열을 HTMLImageElement 로 로드하는 훅.
 * Konva.Image 렌더링에 사용합니다.
 */
export function useDataUrlImage(src: string): HTMLImageElement | undefined {
  const [image, setImage] = useState<HTMLImageElement>();

  useEffect(() => {
    if (!src) {
      setImage(undefined);
      return;
    }
    let active = true;
    const img = new window.Image();
    img.onload = () => {
      if (active) setImage(img);
    };
    img.src = src;
    return () => {
      active = false;
    };
  }, [src]);

  return image;
}

import { useEffect, useRef } from 'react';
import type Konva from 'konva';

/**
 * 이미지 크기/회전 조절용 Konva.Transformer 를 캔버스 레벨에서 관리하는 훅.
 * 선택된 이미지 노드에 Transformer 를 붙입니다.
 *
 * (ImageNode 내부에서 ref/effect 를 쓰면 Konva 트리 안 훅 호출 문제가 있어
 *  캔버스 컴포넌트에서 관리합니다.)
 */
export function useImageTransformer(selectedImageId: string | null) {
  const transformerRef = useRef<Konva.Transformer>(null);
  const nodeRefs = useRef(new Map<string, Konva.Image>());

  const register = (id: string) => (node: Konva.Image | null) => {
    if (node) nodeRefs.current.set(id, node);
    else nodeRefs.current.delete(id);
  };

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selectedImageId ? nodeRefs.current.get(selectedImageId) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  });

  return { transformerRef, register };
}

import { useEffect } from 'react';
import { useEditor } from './EditorContext';

/** 방향키 기본 이동량(mm), Shift 동반 시 큰 이동량 */
const NUDGE_MM = 100;
const NUDGE_MM_SHIFT = 500;

/**
 * 편집기 키보드 단축키.
 *  - Delete / Backspace : 삭제
 *  - R                   : 90도 회전
 *  - Ctrl/Cmd + D        : 복사
 *  - 방향키              : 100mm 이동 (Shift 동반 시 500mm)
 *
 * 입력 필드(위치 직접 입력 등)에 포커스가 있을 때는 동작하지 않습니다.
 * 렌더링은 없고 전역 keydown 리스너만 관리합니다.
 */
export default function EditorHotkeys() {
  const {
    selectedItem,
    deleteSelected,
    rotateSelected,
    copySelected,
    nudgeSelected,
  } = useEditor();

  useEffect(() => {
    const isTypingTarget = (el: EventTarget | null): boolean => {
      const node = el as HTMLElement | null;
      if (!node) return false;
      const tag = node.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || node.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (!selectedItem) return;

      const step = e.shiftKey ? NUDGE_MM_SHIFT : NUDGE_MM;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          deleteSelected();
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          rotateSelected();
          break;
        case 'd':
        case 'D':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            copySelected();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          nudgeSelected(0, -step);
          break;
        case 'ArrowDown':
          e.preventDefault();
          nudgeSelected(0, step);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          nudgeSelected(-step, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          nudgeSelected(step, 0);
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedItem, deleteSelected, rotateSelected, copySelected, nudgeSelected]);

  return null;
}

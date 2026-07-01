import AppLayout from '../components/layout/AppLayout';
import { EditorProvider } from '../features/editor/EditorContext';
import EditorHotkeys from '../features/editor/EditorHotkeys';
import FixtureLibraryPanel from '../features/fixtures/FixtureLibraryPanel';
import SelectionPanel from '../features/editor/SelectionPanel';
import EditorCanvasArea from '../features/editor/EditorCanvasArea';

/**
 * 편집기 라우트 조합.
 *
 * EditorProvider 로 세 영역(집기 라이브러리 / 캔버스 / 선택 정보)이 배치 상태를
 * 공유합니다. 무거운 React Konva 캔버스를 포함하므로 App.tsx 에서 lazy 로 불러
 * 홈/목록 진입 시에는 로드하지 않습니다.
 */
export default function EditorRoute() {
  return (
    <EditorProvider>
      <EditorHotkeys />
      <AppLayout
        leftSidebar={<FixtureLibraryPanel />}
        rightPanel={<SelectionPanel />}
        padded={false}
      >
        <EditorCanvasArea />
      </AppLayout>
    </EditorProvider>
  );
}

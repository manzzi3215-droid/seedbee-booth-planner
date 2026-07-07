import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import AppLayout from './components/layout/AppLayout';
import NavSidebar from './components/layout/NavSidebar';
import HomePage from './pages/HomePage';
import ProjectListPage from './pages/ProjectListPage';
import NewProjectPage from './pages/NewProjectPage';
import { isCloudStorage } from './storage';
import { getFirebase } from './firebase/app';

// 편집기는 무거운 React Konva 를 사용하므로 지연 로딩(코드 분할)
const EditorRoute = lazy(() => import('./pages/EditorRoute'));
const ShareRoute = lazy(() => import('./pages/ShareRoute'));
const VmdWorkspace = lazy(() => import('./features/vmd/VmdWorkspace'));

function FullScreenLoader() {
  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <CircularProgress />
    </Box>
  );
}

/**
 * 앱 루트 + 라우팅.
 *
 * 일반 페이지(홈/목록/생성)는 [네비게이션 사이드바 + 메인] 셸을 쓰고,
 * 편집기는 [집기 라이브러리 + 캔버스 + 선택 정보] 3분할 셸을 씁니다.
 */
export default function App() {
  // 앱 실행 시 익명 로그인 선행(클라우드 설정 시). 실패해도 LocalStorage 로 동작.
  useEffect(() => {
    if (isCloudStorage) getFirebase().catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <AppLayout leftSidebar={<NavSidebar />}>
              <HomePage />
            </AppLayout>
          }
        />
        <Route
          path="/projects"
          element={
            <AppLayout leftSidebar={<NavSidebar />}>
              <ProjectListPage />
            </AppLayout>
          }
        />
        <Route
          path="/projects/new"
          element={
            <AppLayout leftSidebar={<NavSidebar />}>
              <NewProjectPage />
            </AppLayout>
          }
        />
        <Route
          path="/projects/:projectId/editor"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <EditorRoute />
            </Suspense>
          }
        />
        <Route
          path="/projects/:projectId/vmd"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <VmdWorkspace />
            </Suspense>
          }
        />
        <Route
          path="/share/:shareId"
          element={
            <Suspense fallback={<FullScreenLoader />}>
              <ShareRoute />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

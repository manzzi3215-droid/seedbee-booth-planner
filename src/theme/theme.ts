import { createTheme } from '@mui/material/styles';

/**
 * 앱 전역 MUI 테마.
 * 색상/타이포 등은 이후 필요에 따라 조정합니다.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb', // blue 600
    },
    secondary: {
      main: '#7c3aed', // violet 600
    },
    background: {
      default: '#f5f6f8',
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: [
      'Pretendard',
      'system-ui',
      '-apple-system',
      'Segoe UI',
      'Roboto',
      'sans-serif',
    ].join(','),
  },
});

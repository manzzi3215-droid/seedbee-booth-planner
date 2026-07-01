import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import { Link as RouterLink } from 'react-router-dom';

/**
 * 앱 상단 헤더.
 * 로고 클릭 시 홈으로 이동합니다.
 * 이후 단계에서 저장/불러오기/출력 등의 액션 버튼이 여기에 추가됩니다.
 */
export default function AppHeader() {
  return (
    <AppBar
      position="static"
      color="default"
      elevation={0}
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        zIndex: (t) => t.zIndex.drawer + 1,
      }}
    >
      <Toolbar>
        <Box
          component={RouterLink}
          to="/"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          <GridViewRoundedIcon color="primary" />
          <Typography variant="h6" component="h1" sx={{ fontWeight: 700 }}>
            Booth Layout Planner
          </Typography>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

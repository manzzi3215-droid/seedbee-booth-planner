import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: '홈', path: '/', icon: <HomeRoundedIcon /> },
  { label: '프로젝트 목록', path: '/projects', icon: <FolderRoundedIcon /> },
];

/**
 * 일반 페이지(홈/목록/생성)에서 사용하는 왼쪽 네비게이션 사이드바.
 * 편집기 화면에서는 대신 "집기 라이브러리"가 이 자리에 들어갑니다.
 */
export default function NavSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <List sx={{ py: 1 }}>
      {NAV_ITEMS.map((item) => {
        const selected =
          item.path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.path);
        return (
          <ListItemButton
            key={item.path}
            selected={selected}
            onClick={() => navigate(item.path)}
            sx={{ mx: 1, borderRadius: 1.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        );
      })}
    </List>
  );
}

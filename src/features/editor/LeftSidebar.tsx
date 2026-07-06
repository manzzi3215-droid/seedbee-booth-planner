import { useState } from 'react';
import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import ChairRoundedIcon from '@mui/icons-material/ChairRounded';
import ShoppingBagRoundedIcon from '@mui/icons-material/ShoppingBagRounded';
import BookmarksRoundedIcon from '@mui/icons-material/BookmarksRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import FixtureLibraryPanel from '../fixtures/FixtureLibraryPanel';
import ProductLibraryPanel from '../products/ProductLibraryPanel';
import DisplayPresetsPanel from '../products/DisplayPresetsPanel';
import DrawingsPanel from '../floorplan/DrawingsPanel';

/**
 * 편집기 왼쪽 사이드바 — 집기(Furniture) / 제품(Products) 레이어 분리 (Merchandising Mode, v0.9.3).
 */
export default function LeftSidebar() {
  const [tab, setTab] = useState<'drawings' | 'furniture' | 'products' | 'presets'>('furniture');
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="fullWidth"
        sx={{ minHeight: 42, borderBottom: '1px solid', borderColor: 'divider', '& .MuiTab-root': { minWidth: 0, px: 0.5 } }}
      >
        <Tab value="drawings" icon={<MapRoundedIcon fontSize="small" />} iconPosition="start" label="도면" sx={{ minHeight: 42, py: 0 }} />
        <Tab value="furniture" icon={<ChairRoundedIcon fontSize="small" />} iconPosition="start" label="집기" sx={{ minHeight: 42, py: 0 }} />
        <Tab value="products" icon={<ShoppingBagRoundedIcon fontSize="small" />} iconPosition="start" label="제품" sx={{ minHeight: 42, py: 0 }} />
        <Tab value="presets" icon={<BookmarksRoundedIcon fontSize="small" />} iconPosition="start" label="프리셋" sx={{ minHeight: 42, py: 0 }} />
      </Tabs>
      <Box sx={{ flex: 1, minHeight: 0, display: tab === 'drawings' ? 'block' : 'none' }}>
        <DrawingsPanel />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: tab === 'furniture' ? 'block' : 'none' }}>
        <FixtureLibraryPanel />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: tab === 'products' ? 'block' : 'none' }}>
        <ProductLibraryPanel />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, display: tab === 'presets' ? 'block' : 'none' }}>
        <DisplayPresetsPanel />
      </Box>
    </Box>
  );
}

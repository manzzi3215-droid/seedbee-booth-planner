import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import Tooltip from '@mui/material/Tooltip';
import { useNavigate } from 'react-router-dom';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import type { Project } from '../types';
import { storage } from '../storage';
import { getBoothSizeLabel, getFloorLabel } from '../constants/booth';
import { getProjectLastModified, getSharedWith, getVisibility } from '../utils/project';
import { useAuthUser } from '../firebase/useAuthUser';
import ShareProjectDialog from '../features/projects/ShareProjectDialog';

/** epoch millis 를 YYYY.MM.DD 로 */
function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

/**
 * 프로젝트 목록 화면 (/projects).
 * storage.getProjects 로 실제 저장 데이터를 표시합니다.
 */
export default function ProjectListPage() {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareTarget, setShareTarget] = useState<Project | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setProjects(await storage.getProjects());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDelete = async (project: Project) => {
    const ok = window.confirm(`"${project.name}" 프로젝트를 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`);
    if (!ok) return;
    await storage.deleteProject(project.id);
    await load();
  };

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto' }}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 3 }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          프로젝트 목록
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddRoundedIcon />}
          onClick={() => navigate('/projects/new')}
        >
          새 프로젝트 만들기
        </Button>
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : projects.length === 0 ? (
        <Paper
          elevation={0}
          sx={{ p: 6, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}
        >
          <Inventory2OutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            저장된 프로젝트가 없습니다
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            새 프로젝트를 만들어 부스 설계를 시작해 보세요.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigate('/projects/new')}
          >
            새 프로젝트 만들기
          </Button>
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {projects.map((p) => (
            <Paper
              key={p.id}
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                  {p.name}
                </Typography>
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}
                >
                  <Chip size="small" label={getBoothSizeLabel(p.boothConfig)} />
                  <Chip size="small" variant="outlined" label={`${p.boothConfig.openSide}면 오픈`} />
                  <Chip size="small" variant="outlined" label={getFloorLabel(p.boothConfig)} />
                  <Chip
                    size="small"
                    variant="outlined"
                    icon={<LayersRoundedIcon />}
                    label={`배치안 ${p.layouts.length}개`}
                  />
                  {getVisibility(p) === 'shared' ? (
                    <Chip
                      size="small"
                      color="success"
                      variant="outlined"
                      icon={<GroupRoundedIcon />}
                      label={`공유됨 · ${getSharedWith(p).length}명`}
                    />
                  ) : (
                    <Chip size="small" variant="outlined" label="비공개" />
                  )}
                  <Typography variant="caption" color="text.secondary">
                    수정 {formatDate(getProjectLastModified(p))}
                  </Typography>
                </Stack>
              </Box>

              <Button
                variant="outlined"
                size="small"
                startIcon={<ShareRoundedIcon />}
                onClick={() => setShareTarget(p)}
              >
                공유
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditRoundedIcon />}
                onClick={() => navigate(`/projects/${p.id}/editor`)}
              >
                편집하기
              </Button>
              <Tooltip title="삭제">
                <IconButton aria-label="삭제" color="error" onClick={() => handleDelete(p)}>
                  <DeleteOutlineRoundedIcon />
                </IconButton>
              </Tooltip>
            </Paper>
          ))}
        </Stack>
      )}

      <ShareProjectDialog
        open={shareTarget !== null}
        project={shareTarget}
        currentEmail={user?.email ?? null}
        onClose={() => setShareTarget(null)}
        onSaved={load}
      />
    </Box>
  );
}

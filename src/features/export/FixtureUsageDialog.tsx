import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';
import type { FixtureUsageRow } from './fixtureUsage';

/**
 * 사용 집기 리스트 Dialog.
 * 현재 배치안에 사용된 집기를 fixtureDefId 기준 수량 합산으로 표시합니다.
 */
export default function FixtureUsageDialog({
  open,
  rows,
  onClose,
}: {
  open: boolean;
  rows: FixtureUsageRow[];
  onClose: () => void;
}) {
  const total = rows.reduce((sum, r) => sum + r.quantity, 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>사용 집기 리스트 (총 {total}개)</DialogTitle>
      <DialogContent dividers>
        {rows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            배치된 집기가 없습니다.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>집기명</TableCell>
                <TableCell>형태</TableCell>
                <TableCell>사이즈</TableCell>
                <TableCell align="right">수량</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.fixtureDefId}>
                  <TableCell sx={{ fontWeight: 600 }}>{r.name}</TableCell>
                  <TableCell>{r.shapeLabel}</TableCell>
                  <TableCell>{r.sizeLabel}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {r.quantity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>닫기</Button>
      </DialogActions>
    </Dialog>
  );
}

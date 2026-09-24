import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

/**
 * Live connection-status badge for a page header, derived from query status.
 * Shows a spinner while connecting/refreshing and a colored dot otherwise.
 */
export default function ConnectionBadge({
  status,
  refreshing,
}: {
  status?: 'pending' | 'success' | 'error';
  refreshing?: boolean;
}) {
  const isConnecting = status === 'pending' || refreshing;
  const isOk = status === 'success' && !refreshing;
  const isError = status === 'error';
  const dotColor = isError
    ? 'error.main'
    : isOk
      ? 'success.main'
      : 'text.primary';
  const label = isError
    ? 'Connection failed'
    : isOk
      ? 'Connected'
      : refreshing
        ? 'Refreshing…'
        : 'Connecting…';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
        borderRadius: 999,
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      {isConnecting ? (
        <CircularProgress size={14} />
      ) : (
        <Box
          sx={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            bgcolor: dotColor,
            flex: 'none',
          }}
        />
      )}
      <Typography variant="caption" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
    </Box>
  );
}
import { useMemo, type ReactNode } from 'react';
import { keyframes } from '@emotion/react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import { Gauge, RefreshCw } from 'lucide-react';

import { grafanaClient } from '../services/grafanaClient';
import type {
  GrafanaDataFrames,
  GrafanaQueryModel,
  GrafanaTimeRange,
} from '../types/grafana';

const DAY = 86_400;
const HOUR = 3_600;
const MINUTE = 60;
const BYTES_PER_GB = 1024 ** 3;
const REFRESH_INTERVAL_MS = 60_000;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/** Extracted series data from a single Grafana data frame. */
interface ExtractedSeries {
  /** Label set attached to the value field (Prometheus labels). */
  labels: Record<string, string>;
  /** Most recent value, or null when the frame has no numeric value column. */
  lastValue: number | null;
  /** All values in the column (chronological). */
  values: number[];
}

/**
 * Pull the value column + labels out of a Grafana frame.
 *
 * Grafana returns frames as columnar arrays where the first column is `Time`
 * and the last numeric column holds the series values. Labels live on the value
 * field's schema (they are NOT part of the row values), so label-only metrics
 * such as `node_uname_info` carry their data entirely in `labels` with a value
 * of 1. We rely on the value column length, not `schema.length` (which the
 * backend reports as 0 for constant/label series).
 */
function extractSeries(frame: GrafanaDataFrames | undefined): ExtractedSeries {
  if (!frame?.schema?.fields?.length) {
    return { labels: {}, lastValue: null, values: [] };
  }
  const fields = frame.schema.fields;
  const valueIdx = fields.findIndex(
    (f) => f.type === 'number' || f.type === 'double',
  );
  if (valueIdx === -1) return { labels: {}, lastValue: null, values: [] };

  const valueField = fields[valueIdx];
  const values = (frame.data.values[valueIdx] as number[]) ?? [];
  return {
    labels: valueField.labels ?? {},
    lastValue: values.length ? values[values.length - 1] : null,
    values,
  };
}

/** Format a duration in seconds as "Xd Yh Zm". */
function formatUptime(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(secs / DAY);
  const hours = Math.floor((secs % DAY) / HOUR);
  const minutes = Math.floor((secs % HOUR) / MINUTE);
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.join(' ') || '< 1m';
}

/** Format a byte count as GB (2 decimals). */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—';
  return (bytes / BYTES_PER_GB).toFixed(2);
}

/** A simple labeled "key → value" row used across the summary cards. */
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 2,
        py: 0.75,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body1"
        color="text.primary"
        sx={{ textAlign: 'right', fontWeight: 600, wordBreak: 'break-word' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/** Live connection-status badge for the header, derived from the query status. */
function ConnectionBadge({
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
      : isConnecting
        ? refreshing
          ? 'Refreshing…'
          : 'Connecting…'
        : 'Connected';

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

export default function Overview() {
  const unameQueries = useMemo<GrafanaQueryModel[]>(
    () => [{ refId: 'A', query: 'node_uname_info' }],
    [],
  );
  const cpuQueries = useMemo<GrafanaQueryModel[]>(
    () => [{ refId: 'B', query: 'count(count(node_cpu_seconds_total) by (cpu))' }],
    [],
  );
  const gpuQueries = useMemo<GrafanaQueryModel[]>(
    () => [{ refId: 'C', query: 'gpu_memory_total_bytes' }],
    [],
  );
  const uptimeQueries = useMemo<GrafanaQueryModel[]>(
    () => [{ refId: 'D', query: 'node_boot_time_seconds' }],
    [],
  );

  // Sliding window: regenerated on every fetch (auto or manual), so each
  // refresh queries up to "now" again instead of the mount-time end point.
  const getCurrentRange = (): GrafanaTimeRange => {
    const to = Date.now();
    return { from: to - DAY * 2 * 1000, to };
  };

  const unameQuery = useQuery({
    queryKey: ['overview', 'uname'],
    queryFn: () => grafanaClient.query(unameQueries, getCurrentRange()),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const cpuQuery = useQuery({
    queryKey: ['overview', 'cpu'],
    queryFn: () => grafanaClient.query(cpuQueries, getCurrentRange()),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const gpuQuery = useQuery({
    queryKey: ['overview', 'gpu'],
    queryFn: () => grafanaClient.query(gpuQueries, getCurrentRange()),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const uptimeQuery = useQuery({
    queryKey: ['overview', 'uptime'],
    queryFn: () => grafanaClient.query(uptimeQueries, getCurrentRange()),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  // Extract structured values from the first returned frame.
  const unameInfo = (() => {
    const s = extractSeries(unameQuery.data?.results?.A?.frames?.[0]);
    return {
      hostname: s.labels.nodename ?? '—',
      os: s.labels.sysname ?? '—',
      kernel: s.labels.release ?? '—',
      arch: s.labels.machine ?? '—',
    };
  })();

  const cpuCores = extractSeries(cpuQuery.data?.results?.B?.frames?.[0]).lastValue;

  const gpuInfo = (() => {
    const s = extractSeries(gpuQuery.data?.results?.C?.frames?.[0]);
    return {
      name: s.labels.gpu_name ?? 'Unknown GPU',
      vramGb: s.lastValue !== null ? formatBytes(s.lastValue) : null,
    };
  })();

  // Boot epoch is a constant series, so its last value is always correct even
// when the query step lags the present (2-day ranges sample every ~40 min).
// Uptime = now - boot, which therefore tracks reality on every refresh.
  const bootSeconds = extractSeries(uptimeQuery.data?.results?.D?.frames?.[0]).lastValue;
  const uptimeSeconds = bootSeconds !== null ? Date.now() / 1000 - bootSeconds : null;

  const loading =
    unameQuery.isLoading ||
    cpuQuery.isLoading ||
    gpuQuery.isLoading ||
    uptimeQuery.isLoading;
  const refreshing =
    (unameQuery.isFetching ||
      cpuQuery.isFetching ||
      gpuQuery.isFetching ||
      uptimeQuery.isFetching) &&
    !loading;
  const error =
    unameQuery.error ??
    cpuQuery.error ??
    gpuQuery.error ??
    uptimeQuery.error;

  const lastUpdated = Math.max(
    unameQuery.dataUpdatedAt,
    cpuQuery.dataUpdatedAt,
    gpuQuery.dataUpdatedAt,
    uptimeQuery.dataUpdatedAt,
  );

  const handleRefresh = () => {
    void unameQuery.refetch();
    void cpuQuery.refetch();
    void gpuQuery.refetch();
    void uptimeQuery.refetch();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h4" color="text.primary" gutterBottom>
            Overview
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Host, GPU &amp; Home Assistant status at a glance.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ConnectionBadge status={unameQuery.status} refreshing={refreshing} />
            <Tooltip title="Refresh data">
              <IconButton
                aria-label="Refresh data"
                onClick={handleRefresh}
                sx={{ color: 'text.secondary' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    animation: refreshing
                      ? `${spin} 0.9s linear infinite`
                      : undefined,
                  }}
                >
                  <RefreshCw size={20} />
                </Box>
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Updated {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
          </Typography>
        </Box>
      </Box>

      {loading && <LinearProgress />}
      {error && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body1" color="error.main">
              Unable to fetch metrics.
            </Typography>
            {error instanceof Error && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {error.message}
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        }}
      >
        {/* System Summary Card */}
        <Card>
          <CardHeader
            title="System Summary"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <Divider />
          <CardContent>
            <InfoRow label="Hostname" value={unameInfo.hostname} />
            <InfoRow label="Operating System" value={unameInfo.os} />
            <InfoRow label="Kernel" value={unameInfo.kernel} />
            <InfoRow label="Architecture" value={unameInfo.arch} />
            <InfoRow
              label="CPU Threads"
              value={cpuCores !== null ? `${cpuCores} threads` : '—'}
            />
            <InfoRow
              label="Uptime"
              value={uptimeSeconds !== null ? formatUptime(uptimeSeconds) : '—'}
            />
          </CardContent>
        </Card>

        {/* GPU Snapshot Card */}
        <Card>
          <CardHeader
            title="GPU Snapshot"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <Divider />
          <CardContent>
            <InfoRow label="Model" value={gpuInfo.name} />
            <InfoRow
              label="Total VRAM"
              value={gpuInfo.vramGb !== null ? `${gpuInfo.vramGb} GB` : '—'}
            />
          </CardContent>
        </Card>

        {/* Home Assistant Quick Status (placeholder) */}
        <Card sx={{ gridColumn: { xs: 'span 1', sm: 'span 2' } }}>
          <CardHeader
            title="Home Assistant Quick Status"
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 0 }}
          />
          <Divider />
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
              <Gauge size={20} color="#fab387" />
              <Typography variant="body1" color="text.secondary">
                Home Assistant integration is coming in a later phase.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}

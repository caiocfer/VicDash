import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { keyframes } from '@emotion/react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { useTheme } from '@mui/material';
import { RefreshCw } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { grafanaClient } from '../services/grafanaClient';
import ConnectionBadge from '../components/ConnectionBadge';
import type {
  GrafanaDataFrames,
  GrafanaQueryModel,
  GrafanaTimeRange,
} from '../types/grafana';

const MINUTE = 60;
const GIB = 1024 ** 3;
const LIVE_MINUTES = 15;
const REFRESH_INTERVAL_MS = 60_000;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/** Extracted series: labels, latest value and (time, value) points. */
interface Series {
  labels: Record<string, string>;
  lastValue: number | null;
  points: { time: number; value: number }[];
}

function extractSeries(frame: GrafanaDataFrames | undefined): Series {
  const fields = frame?.schema?.fields ?? [];
  const timeIdx = fields.findIndex((f) => f.type === 'time');
  const valIdx = fields.findIndex(
    (f) => f.type === 'number' || f.type === 'double',
  );
  const values = (frame?.data?.values?.[valIdx] ?? []) as number[];
  const times = (frame?.data?.values?.[timeIdx] ?? []) as number[];
  const points = times
    .map((t, i) => ({ time: t, value: values[i] ?? NaN }))
    .filter((p) => Number.isFinite(p.value));
  return {
    labels: fields[valIdx]?.labels ?? {},
    lastValue: values.length ? values[values.length - 1] : null,
    points,
  };
}

const formatGiB = (bytes: number | null): string =>
  bytes !== null && Number.isFinite(bytes)
    ? `${(bytes / GIB).toFixed(2)} GiB`
    : '—';

const timeLabel = (t: number): string =>
  new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** Maps a value to MUI LinearProgress color based on a "red line" threshold. */
function barColor(value: number, redAt = 80): 'success' | 'warning' | 'error' {
  if (value >= redAt) return 'error';
  if (value >= redAt * 0.75) return 'warning';
  return 'success';
}

/** Compact stat card for GPU live values. */
function StatCard({
  title,
  value,
  sub,
  accent = 'default',
}: {
  title: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: 'default' | 'ok' | 'warn' | 'err';
}) {
  const color =
    accent === 'err'
      ? 'error.main'
      : accent === 'warn'
        ? 'warning.main'
        : accent === 'ok'
          ? 'success.main'
          : 'text.primary';
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h4" color={color} sx={{ fontWeight: 700, mt: 0.5 }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {sub}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/** One metric's history chart (line or area). */
function MetricChart({
  title,
  data,
  unit,
  color,
  kind = 'line',
}: {
  title: string;
  data: { time: number; value: number }[];
  unit: string;
  color: string;
  kind?: 'line' | 'area';
}) {
  return (
    <Card>
      <CardHeader
        title={title}
        titleTypographyProps={{ variant: 'h6' }}
        sx={{ pb: 0 }}
      />
      <Divider />
      <CardContent sx={{ pt: 2 }}>
        {data.length > 1 ? (
          <ResponsiveContainer width="100%" height={180}>
            {kind === 'area' ? (
              <AreaChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
                <XAxis
                  dataKey="time"
                  tickFormatter={timeLabel}
                  stroke="#a6adc8"
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#a6adc8" tick={{ fontSize: 11 }} width={52} />
                <RechartsTooltip
                  labelFormatter={(t) => timeLabel(Number(t))}
                  formatter={(value) => [`${Number(value).toFixed(1)} ${unit}`, title]}
                  contentStyle={{
                    backgroundColor: '#11111b',
                    border: '1px solid #313244',
                    borderRadius: 8,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={color}
                  fillOpacity={0.15}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            ) : (
              <LineChart data={data} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#313244" />
                <XAxis
                  dataKey="time"
                  tickFormatter={timeLabel}
                  stroke="#a6adc8"
                  tick={{ fontSize: 11 }}
                />
                <YAxis stroke="#a6adc8" tick={{ fontSize: 11 }} width={52} />
                <RechartsTooltip
                  labelFormatter={(t) => timeLabel(Number(t))}
                  formatter={(value) => [`${Number(value).toFixed(1)} ${unit}`, title]}
                  contentStyle={{
                    backgroundColor: '#11111b',
                    border: '1px solid #313244',
                    borderRadius: 8,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <Box
            sx={{
              height: 180,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              No data yet
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function Gpu() {
  const theme = useTheme();
  const palette = theme.palette;

  const queries = useMemo<GrafanaQueryModel[]>(
    () => [
      { refId: 'A', query: 'gpu_utilization_percent' },
      { refId: 'B', query: 'gpu_temperature_celsius' },
      { refId: 'C', query: 'gpu_fan_speed_percent' },
      { refId: 'D', query: 'gpu_power_usage_milliwatts' },
      { refId: 'E', query: 'gpu_memory_usage_bytes' },
      { refId: 'F', query: 'gpu_memory_total_bytes' },
      { refId: 'G', query: 'gpu_process_sm_utilization_percent' },
      { refId: 'H', query: 'gpu_process_memory_bytes' },
    ],
    [],
  );

  // Short sliding window: regenerated per fetch so the last sample is current.
  const liveRange = (): GrafanaTimeRange => {
    const to = Date.now();
    return { from: to - MINUTE * LIVE_MINUTES * 1000, to };
  };

  const gpuQuery = useQuery({
    queryKey: ['gpu', 'live'],
    queryFn: () => grafanaClient.query(queries, liveRange()),
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const res = gpuQuery.data?.results;
  const util = extractSeries(res?.A?.frames?.[0]);
  const temp = extractSeries(res?.B?.frames?.[0]);
  const fan = extractSeries(res?.C?.frames?.[0]);
  const power = extractSeries(res?.D?.frames?.[0]);
  const memUsed = extractSeries(res?.E?.frames?.[0]);
  const memTotal = extractSeries(res?.F?.frames?.[0]);

  const gpuName = util.labels.gpu_name ?? 'GPU';

  // Aggregate per-process series (multiple PIDs per process possible).
  interface ProcRow {
    name: string;
    sm: number;
    vramBytes: number;
    pids: Set<string>;
  }
  const procMap = new Map<string, ProcRow>();
  for (const f of res?.G?.frames ?? []) {
    const s = extractSeries(f);
    const name = s.labels.process_name ?? 'unknown';
    const row = procMap.get(name) ?? { name, sm: 0, vramBytes: 0, pids: new Set() };
    row.sm = Math.max(row.sm, s.lastValue ?? 0);
    procMap.set(name, row);
  }
  for (const f of res?.H?.frames ?? []) {
    const s = extractSeries(f);
    const name = s.labels.process_name ?? 'unknown';
    const row = procMap.get(name) ?? { name, sm: 0, vramBytes: 0, pids: new Set() };
    row.vramBytes += s.lastValue ?? 0;
    if (s.labels.pid) row.pids.add(s.labels.pid);
    procMap.set(name, row);
  }
  const processRows = [...procMap.values()].sort((a, b) => b.sm - a.sm);

  const vramUsed = memUsed.lastValue ?? 0;
  const vramTotal = memTotal.lastValue ?? 0;
  const vramPct = vramTotal > 0 ? (vramUsed / vramTotal) * 100 : 0;

  const loading = gpuQuery.isLoading;
  const refreshing = gpuQuery.isFetching && !loading;
  const error = gpuQuery.error;

  const handleRefresh = () => {
    void gpuQuery.refetch();
  };

  const utilPct = util.lastValue ?? null;
  const tempC = temp.lastValue ?? null;
  const fanPct = fan.lastValue ?? null;
  const powerW = power.lastValue !== null ? power.lastValue / 1000 : null;

  // Chart series (converted to display units).
  const utilSeries = util.points;
  const tempSeries = temp.points;
  const powerSeries = power.points.map((p) => ({ time: p.time, value: p.value / 1000 }));
  const memSeries = memUsed.points.map((p) => ({ time: p.time, value: p.value / GIB }));

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
            GPU
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {gpuName} — live status
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ConnectionBadge status={gpuQuery.status} refreshing={refreshing} />
            <Tooltip title="Refresh data">
              <IconButton
                aria-label="Refresh data"
                onClick={handleRefresh}
                sx={{ color: 'text.secondary' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    animation: refreshing ? `${spin} 0.9s linear infinite` : undefined,
                  }}
                >
                  <RefreshCw size={20} />
                </Box>
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            Updated{' '}
            {gpuQuery.dataUpdatedAt
              ? new Date(gpuQuery.dataUpdatedAt).toLocaleTimeString()
              : '—'}
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

      {/* Live stat cards */}
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(3, 1fr)',
          },
        }}
      >
        <StatCard
          title="GPU Utilization"
          value={utilPct !== null ? `${utilPct.toFixed(0)}%` : '—'}
          sub="Streaming multiprocessor utilization"
          accent={utilPct !== null ? (utilPct >= 80 ? 'err' : utilPct >= 60 ? 'warn' : 'ok') : 'default'}
        />
        <StatCard
          title="GPU Temperature"
          value={tempC !== null ? `${tempC.toFixed(0)}°C` : '—'}
          sub="Core temperature"
          accent={tempC !== null ? (tempC >= 80 ? 'err' : tempC >= 60 ? 'warn' : 'ok') : 'default'}
        />
        <StatCard
          title="Fan Speed"
          value={fanPct !== null ? (fanPct === 0 ? 'Off' : `${fanPct.toFixed(0)}%`) : '—'}
          sub={fanPct === 0 ? 'Fans stopped at idle' : 'Fan speed'}
          accent="default"
        />
        <StatCard
          title="Power Draw"
          value={powerW !== null ? `${powerW.toFixed(1)} W` : '—'}
          sub="Instant power consumption"
          accent="default"
        />
        <StatCard title="VRAM Used" value={formatGiB(vramUsed)} sub="Memory in use" accent="default" />
        <StatCard title="VRAM Total" value={formatGiB(vramTotal)} sub="Total memory" accent="default" />
      </Box>

      {/* VRAM usage bar */}
      <Card sx={{ mt: 3 }}>
        <CardHeader
          title="VRAM Usage"
          titleTypographyProps={{ variant: 'h6' }}
          sx={{ pb: 0 }}
        />
        <Divider />
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {formatGiB(vramUsed)} / {formatGiB(vramTotal)}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {vramPct.toFixed(0)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, vramPct)}
            color={vramPct > 0 ? barColor(vramPct) : 'primary'}
            sx={{ height: 8, borderRadius: 999 }}
          />
        </CardContent>
      </Card>

      {/* History charts */}
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          mt: 3,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        <MetricChart
          title="Utilization"
          data={utilSeries}
          unit="%"
          color={palette.primary.main}
        />
        <MetricChart
          title="Power Draw"
          data={powerSeries}
          unit="W"
          color={palette.secondary.main}
          kind="area"
        />
        <MetricChart
          title="Temperature"
          data={tempSeries}
          unit="°C"
          color={palette.warning.main}
        />
        <MetricChart
          title="VRAM Used"
          data={memSeries}
          unit="GiB"
          color={palette.info.main}
          kind="area"
        />
      </Box>

      {/* Per-process breakdown */}
      <Card sx={{ mt: 3 }}>
        <CardHeader
          title="GPU Processes"
          titleTypographyProps={{ variant: 'h6' }}
          sx={{ pb: 0 }}
        />
        <Divider />
        <CardContent sx={{ px: 0, py: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Process</TableCell>
                <TableCell>SM Utilization</TableCell>
                <TableCell>VRAM</TableCell>
                <TableCell>PID(s)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {processRows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, row.sm)}
                        color={barColor(row.sm)}
                        sx={{ flex: 1, maxWidth: 140, borderRadius: 999 }}
                      />
                      <Typography variant="body2">
                        {row.sm.toFixed(0)}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{(row.vramBytes / GIB).toFixed(2)} GiB</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {[...row.pids].join(', ') || '—'}
                  </TableCell>
                </TableRow>
              ))}
              {processRows.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    sx={{ textAlign: 'center', color: 'text.secondary', py: 3 }}
                  >
                    No active GPU processes
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
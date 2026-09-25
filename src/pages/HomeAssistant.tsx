import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
import { keyframes } from '@emotion/react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Slider from '@mui/material/Slider';
import Snackbar from '@mui/material/Snackbar';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { RefreshCw, ShieldCheck, Server, Lightbulb, Power, Minus, Plus } from 'lucide-react';

import { haClient, HaApiError } from '../services/haClient';
import ConnectionBadge from '../components/ConnectionBadge';
import type { HaEntity } from '../types/homeAssistant';

const REFRESH_INTERVAL_MS = 60_000;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/**
 * Domains rendered as their own card. Everything not listed here is hidden
 * (no "Other" bucket).
 */
const DOMAIN_ORDER = [
  'light',
  'switch',
  'fan',
  'climate',
  'media_player',
  'cover',
  'lock',
  'binary_sensor',
  'sensor',
  'weather',
  'event',
  'script',
  'input_boolean',
  'number',
  'select',
  'button',
  'vacuum',
  'humidifier',
  'water_heater',
] as const;

/** Domains intentionally hidden from the dashboard. */
const HIDDEN_DOMAINS = new Set([
  'person',
  'device_tracker',
  'notify',
  'todo',
  'automation',
  'scene',
  'update',
]);

const DOMAIN_LABELS: Record<string, string> = {
  light: 'Lights',
  switch: 'Switches',
  fan: 'Fans',
  climate: 'Climate',
  media_player: 'Media Players',
  cover: 'Covers',
  lock: 'Locks',
  binary_sensor: 'Binary Sensors',
  sensor: 'Sensors',
  weather: 'Weather',
  event: 'Events',
  script: 'Scripts',
  input_boolean: 'Input Booleans',
  number: 'Numbers',
  select: 'Selects',
  button: 'Buttons',
  vacuum: 'Vacuum',
  humidifier: 'Humidifiers',
  water_heater: 'Water Heaters',
};

/** States counted as "active" in the summary stat. */
const ACTIVE_STATES = new Set([
  'on',
  'open',
  'playing',
  'home',
  'unlocked',
  'heating',
  'cooling',
  'heat',
  'cool',
  'auto',
  'cleaning',
  'streaming',
  'charging',
]);

const UNAVAILABLE_STATES = new Set(['unavailable', 'unknown']);

/** Friendly display name, falling back to the raw entity_id. */
const friendlyName = (e: HaEntity): string =>
  typeof e.attributes.friendly_name === 'string' && e.attributes.friendly_name
    ? e.attributes.friendly_name
    : e.entity_id;

/**
 * Matches air-conditioner entities by name: "ar-condicionado" / "ar
 * condicionado" / "air condition(er)" / the AC acronym. Checks both the
 * friendly name and the entity_id (e.g. `ar_condicionado_power`).
 */
const isAirConditioner = (e: HaEntity): boolean =>
  /ar[\s-]?condicionado|air[\s-]?condition|a\.c\.|(^|[\s_-])ac([\s_-]|$)/i.test(
    `${e.entity_id} ${friendlyName(e)}`,
  );

/**
 * Matches Pi-hole entities by name: "pi-hole" / "pi_hole" / "pihole"
 * in either the entity_id or the friendly name.
 */
const isPihole = (e: HaEntity): boolean =>
  /pi[\s_-]?hole|pihole/i.test(`${e.entity_id} ${friendlyName(e)}`);

/**
 * Matches Nextcloud entities (dropped from the dashboard for now).
 * Everything from the discovery is named `nextcloud_caiocfer_duckdns_org_*`.
 */
const isNextcloud = (e: HaEntity): boolean =>
  /nextcloud/i.test(`${e.entity_id} ${friendlyName(e)}`);

/** Rich state text with units / brightness / temperature where available. */
function stateText(e: HaEntity): string {
  const domain = e.entity_id.split('.')[0];
  if (domain === 'sensor' && typeof e.attributes.unit_of_measurement === 'string') {
    const unit = e.attributes.unit_of_measurement;
    // Wh reads poorly at thousands — scale to kWh.
    if (/^wh$/i.test(unit.trim()) && e.state !== 'unavailable' && Number.isFinite(Number(e.state))) {
      const kwh = Number(e.state) / 1000;
      const rounded = Math.round(kwh * 100) / 100;
      return `${rounded} kWh`;
    }
    return `${e.state} ${unit}`;
  }
  if (domain === 'climate' && e.attributes.current_temperature != null) {
    const cur = Number(e.attributes.current_temperature);
    const tgt = e.attributes.temperature != null ? Number(e.attributes.temperature) : null;
    return tgt !== null && Number.isFinite(tgt)
      ? `${e.state} · ${cur.toFixed(1)}°C → ${tgt.toFixed(1)}°C`
      : `${e.state} · ${cur.toFixed(1)}°C`;
  }
  if (domain === 'light' && e.attributes.brightness != null) {
    const pct = Math.round((Number(e.attributes.brightness) / 255) * 100);
    return `${e.state} · ${pct}%`;
  }
  if (
    domain === 'media_player' &&
    typeof e.attributes.media_title === 'string' &&
    e.attributes.media_title
  ) {
    return `${e.state} · ${e.attributes.media_title}`;
  }
  return e.state;
}

/** Dot + text colors for a given state. */
function stateColor(state: string): string {
  if (UNAVAILABLE_STATES.has(state)) return 'warning.main';
  if (ACTIVE_STATES.has(state)) return 'success.main';
  return 'text.secondary';
}

/** One domain group rendered as a card with an entity state table. */
function GroupCard({ title, entities }: { title: string; entities: HaEntity[] }) {
  const rows = [...entities].sort((a, b) =>
    friendlyName(a).localeCompare(friendlyName(b)),
  );
  return (
    <Card>
      <CardHeader
        title={title}
        titleTypographyProps={{ variant: 'h6' }}
        subheader={`${entities.length} ${entities.length === 1 ? 'entity' : 'entities'}`}
        sx={{ pb: 0 }}
      />
      <Divider />
      <CardContent sx={{ px: 0, py: 0 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Entity</TableCell>
              <TableCell>State</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((e) => {
              const color = stateColor(e.state);
              return (
                <TableRow key={e.entity_id}>
                  <TableCell sx={{ fontWeight: 600 }}>{friendlyName(e)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: color,
                          flex: 'none',
                        }}
                      />
                      <Typography variant="body2" color={color} sx={{ fontWeight: 600 }}>
                        {stateText(e)}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** A service call payload for the lights-only write path. */
interface ServiceCall {
  domain: string;
  service: string;
  data: Record<string, unknown>;
}

/** One light on its own M3 card: on/off switch + brightness slider. */
function LightCard({
  entity,
  mutation,
  onError,
}: {
  entity: HaEntity;
  mutation: UseMutationResult<void, Error, ServiceCall, unknown>;
  onError: (message: string) => void;
}) {
  const [override, setOverride] = useState<{ on: boolean; brightness?: number } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);

  const modes = (entity.attributes.supported_color_modes as string[] | undefined) ?? [];
  const hasBrightness =
    modes.includes('brightness') || entity.attributes.brightness != null;
  const unavailable = entity.state === 'unavailable';

  const serverPct =
    entity.attributes.brightness != null
      ? Math.round((Number(entity.attributes.brightness) / 255) * 100)
      : 100;
  const on = override?.on ?? entity.state === 'on';
  const pct = drag ?? (override?.brightness != null ? Math.round((override.brightness / 255) * 100) : serverPct);

  // Drop the optimistic override once the server confirms the new state.
  useEffect(() => {
    setOverride(null);
    setDrag(null);
  }, [entity.state, entity.attributes.brightness]);

  const disabled = mutation.isPending || unavailable;

  const toggle = () => {
    const next = !on;
    setOverride({ on: next, brightness: override?.brightness });
    mutation.mutate(
      {
        domain: 'light',
        service: next ? 'turn_on' : 'turn_off',
        data: { entity_id: entity.entity_id },
      },
      {
        onError: (e) => {
          setOverride(null);
          onError(`Failed to turn ${next ? 'on' : 'off'} ${friendlyName(entity)}: ${e.message}`);
        },
      },
    );
  };

  const setBrightness = (_: unknown, value: number | number[]) => {
    const newPct = Array.isArray(value) ? value[0] : value;
    setOverride({ on: true, brightness: Math.round((newPct / 100) * 255) });
    mutation.mutate(
      {
        domain: 'light',
        service: 'turn_on',
        data: { entity_id: entity.entity_id, brightness_pct: newPct },
      },
      {
        onError: (e) => {
          setOverride(null);
          onError(`Failed to change ${friendlyName(entity)} brightness: ${e.message}`);
        },
      },
    );
  };

  return (
    <Card
      sx={{
        opacity: unavailable ? 0.55 : 1,
        transition: 'transform 150ms ease',
        '&:hover': { transform: unavailable ? undefined : 'translateY(-1px)' },
      }}
    >
      <CardContent sx={{ px: 2, py: 1.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          {/* M3 tonal icon tile — clickable, toggles the light like the switch */}
          <IconButton
            aria-label={`Toggle ${friendlyName(entity)}`}
            onClick={toggle}
            disabled={disabled}
            sx={{
              width: 36,
              height: 36,
              p: 0,
              bgcolor: on ? 'primary.main' : 'surface.variant',
              color: on ? 'primary.contrastText' : 'text.disabled',
              boxShadow: on ? '0 0 16px -6px #cba6f7' : 'none',
              transition:
                'background-color 200ms ease, color 200ms ease, box-shadow 200ms ease',
              '&:hover': {
                bgcolor: on ? 'primary.dark' : 'surface.default',
              },
            }}
          >
            <Lightbulb size={18} />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
              {friendlyName(entity)}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {unavailable
                ? 'Unavailable'
                : on
                  ? hasBrightness
                    ? `${pct}%`
                    : 'On'
                  : 'Off'}
            </Typography>
          </Box>
          <Switch checked={on} onChange={toggle} disabled={disabled} size="small" />
        </Box>
        {hasBrightness && on && !unavailable && (
          <Box sx={{ mt: 1, position: 'relative' }}>
            {/* Level-style bar (LinearProgress look) */}
            <LinearProgress
              variant="determinate"
              value={pct}
              color="primary"
              sx={{ height: 6, borderRadius: 999 }}
            />
            {/* Invisible slider overlaid on the bar for drag interaction */}
            <Slider
              aria-label={`${friendlyName(entity)} brightness`}
              size="small"
              value={pct}
              min={1}
              max={100}
              valueLabelDisplay="auto"
              onChange={(_, v) => setDrag(Array.isArray(v) ? v[0] : v)}
              onChangeCommitted={(e, v) => {
                setDrag(null);
                setBrightness(e, v);
              }}
              disabled={mutation.isPending}
              sx={{
                position: 'absolute',
                inset: 0,
                color: 'primary.main',
                '& .MuiSlider-rail, & .MuiSlider-track': { display: 'none' },
                '& .MuiSlider-thumb': {
                  width: 14,
                  height: 14,
                  opacity: 0,
                  transition: 'opacity 120ms ease',
                },
                '&:hover .MuiSlider-thumb, &:active .MuiSlider-thumb, &.Mui-focusVisible .MuiSlider-thumb': {
                  opacity: 1,
                },
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

const prettyLabel = (s: string): string =>
  s
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** M3 filter-style chip (active = filled tonal, inactive = outlined). */
function ModeChip({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Chip
      label={label}
      color={active ? 'primary' : 'default'}
      variant={active ? 'filled' : 'outlined'}
      size="small"
      disabled={disabled}
      onClick={onClick}
      sx={{ fontWeight: 600 }}
    />
  );
}

/**
 * Premium M3 control panel for all AC-related entities (climate + its
 * switches, numbers and sensors). Writable via climate.* and switch.*
 * services — same optimistic pattern as the light cards.
 */
function AirConditionerPanel({
  entities,
  mutation,
  onError,
}: {
  entities: HaEntity[];
  mutation: UseMutationResult<void, Error, ServiceCall, unknown>;
  onError: (message: string) => void;
}) {
  const climate = entities.find((e) => e.entity_id.startsWith('climate.'));
  const acSwitches = entities.filter((e) => e.entity_id.startsWith('switch.'));
  const acSensors = entities.filter((e) => e.entity_id.startsWith('sensor.'));
  // Remaining AC-related entities (number.*, event.*): schedule/sleep settings.
  const acOthers = entities.filter(
    (e) =>
      !e.entity_id.startsWith('climate.') &&
      !e.entity_id.startsWith('switch.') &&
      !e.entity_id.startsWith('sensor.'),
  );

  const [override, setOverride] = useState<{
    hvacMode?: string;
    temperature?: number;
    fanMode?: string;
    swingMode?: string;
  } | null>(null);
  const [switchOn, setSwitchOn] = useState<Record<string, boolean>>({});

  const unavailable = !climate || climate.state === 'unavailable';
  const hvacModes = (climate?.attributes.hvac_modes as string[] | undefined) ?? [];
  const fanModes = (climate?.attributes.fan_modes as string[] | undefined) ?? [];
  const swingModes = (climate?.attributes.swing_modes as string[] | undefined) ?? [];
  const minTemp = Number(climate?.attributes.min_temp ?? 18);
  const maxTemp = Number(climate?.attributes.max_temp ?? 30);
  const step = Number(climate?.attributes.target_temp_step ?? 1);

  const hvacMode = override?.hvacMode ?? ((climate?.state as string | undefined) ?? 'off');
  const target =
    override?.temperature ??
    (climate?.attributes.temperature != null
      ? Number(climate.attributes.temperature)
      : null);
  const current =
    climate?.attributes.current_temperature != null
      ? Number(climate.attributes.current_temperature)
      : null;
  const fanMode = override?.fanMode ?? (climate?.attributes.fan_mode as string | undefined);
  const swingMode = override?.swingMode ?? (climate?.attributes.swing_mode as string | undefined);
  const isOn = hvacMode !== 'off' && hvacMode !== 'unavailable';

  const switchKey = acSwitches.map((s) => `${s.entity_id}:${s.state}`).join('|');
  // Drop optimistic state once the server confirms the new values.
  useEffect(() => {
    setOverride(null);
    setSwitchOn({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [climate?.state, climate?.attributes.temperature, climate?.attributes.fan_mode, climate?.attributes.swing_mode, switchKey]);

  // Fall back to the plain table if there's no climate entity to drive.
  if (!climate) {
    return <GroupCard title="Air Conditioners" entities={entities} />;
  }

  const run = (service: string, data: Record<string, unknown>, label: string) => {
    mutation.mutate(
      { domain: 'climate', service, data: { entity_id: climate.entity_id, ...data } },
      {
        onError: (e) => {
          setOverride(null);
          onError(`${label}: ${e.message}`);
        },
      },
    );
  };

  const togglePower = () => {
    const next = isOn ? 'off' : 'cool';
    setOverride({ ...override, hvacMode: next });
    run('set_hvac_mode', { hvac_mode: next }, 'Failed to toggle AC power');
  };

  const stepTemp = (delta: number) => {
    const base = target ?? current ?? minTemp;
    const raw = Math.round((base + delta) / step) * step;
    const next = Math.min(maxTemp, Math.max(minTemp, raw));
    setOverride({ ...override, temperature: Number(next.toFixed(1)) });
    run('set_temperature', { temperature: next }, 'Failed to set AC temperature');
  };

  const toggleSwitch = (e: HaEntity) => {
    const next = (switchOn[e.entity_id] ?? e.state === 'on') ? false : true;
    setSwitchOn((prev) => ({ ...prev, [e.entity_id]: next }));
    mutation.mutate(
      { domain: 'switch', service: next ? 'turn_on' : 'turn_off', data: { entity_id: e.entity_id } },
      {
        onError: (err) => {
          setSwitchOn((prev) => ({ ...prev, [e.entity_id]: e.state === 'on' }));
          onError(`Failed to toggle ${friendlyName(e)}: ${err.message}`);
        },
      },
    );
  };

  const displayTemp = target ?? current;
  const modeLabel: Record<string, string> = {
    off: 'Off',
    cool: 'Cooling',
    dry: 'Drying',
    fan_only: 'Fan only',
    heat: 'Heating',
    heat_cool: 'Auto',
  };
  const status = unavailable
    ? 'Unavailable'
    : isOn
      ? `${modeLabel[hvacMode] ?? prettyLabel(hvacMode)}${current != null ? ` · ${current.toFixed(1)}°C in room` : ''}`
      : 'Off';

  return (
    <Card>
      <CardContent sx={{ p: 3, opacity: unavailable ? 0.55 : 1 }}>
        {/* Header: power button + name/status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton
            aria-label="Toggle air conditioner power"
            onClick={togglePower}
            disabled={unavailable || mutation.isPending}
            sx={{
              width: 52,
              height: 52,
              p: 0,
              bgcolor: isOn ? 'primary.main' : 'surface.variant',
              color: isOn ? 'primary.contrastText' : 'text.disabled',
              boxShadow: isOn ? '0 0 16px -6px #cba6f7' : 'none',
              transition:
                'background-color 200ms ease, color 200ms ease, box-shadow 200ms ease',
              '&:hover': {
                bgcolor: isOn ? 'primary.dark' : 'surface.default',
              },
            }}
          >
            <Power size={24} />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              {friendlyName(climate)}
            </Typography>
            <Typography variant="body2" color={isOn ? 'success.main' : 'text.secondary'} noWrap>
              {status}
            </Typography>
          </Box>
        </Box>

        {/* Temperature steppers */}
        <Box
          sx={{
            mt: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IconButton
            aria-label="Decrease temperature"
            onClick={() => stepTemp(-step)}
            disabled={!isOn || mutation.isPending}
            sx={{
              width: 44,
              height: 44,
              p: 0,
              bgcolor: 'surface.variant',
              color: 'text.primary',
              '&:hover': { bgcolor: 'surface.default' },
            }}
          >
            <Minus size={22} />
          </IconButton>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1 }}>
              {displayTemp != null ? `${displayTemp.toFixed(1)}°C` : '--'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {target != null ? 'Target' : current != null ? 'Room' : 'Temperature'}
            </Typography>
          </Box>
          <IconButton
            aria-label="Increase temperature"
            onClick={() => stepTemp(step)}
            disabled={!isOn || mutation.isPending}
            sx={{
              width: 44,
              height: 44,
              p: 0,
              bgcolor: 'surface.variant',
              color: 'text.primary',
              '&:hover': { bgcolor: 'surface.default' },
            }}
          >
            <Plus size={22} />
          </IconButton>
        </Box>

        {/* Mode chips */}
        {hvacModes.length > 0 && (
          <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
            {hvacModes.map((m) => (
              <ModeChip
                key={m}
                label={prettyLabel(m)}
                active={hvacMode === m}
                disabled={!isOn || mutation.isPending}
                onClick={() => {
                  setOverride({ ...override, hvacMode: m });
                  run('set_hvac_mode', { hvac_mode: m }, 'Failed to set AC mode');
                }}
              />
            ))}
          </Box>
        )}

        {/* Fan + swing chips */}
        {(fanModes.length > 0 || swingModes.length > 0) && (
          <Box sx={{ mt: 2.5 }}>
            {fanModes.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Fan speed
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {fanModes.map((f) => (
                    <ModeChip
                      key={f}
                      label={prettyLabel(f)}
                      active={fanMode === f}
                      disabled={!isOn || mutation.isPending}
                      onClick={() => {
                        setOverride({ ...override, fanMode: f });
                        run('set_fan_mode', { fan_mode: f }, 'Failed to set AC fan speed');
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
            {swingModes.length > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Swing
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {swingModes
                    .filter((m) => m === 'on' || m === 'off')
                    .map((m) => (
                      <ModeChip
                        key={m}
                        label={prettyLabel(m)}
                        active={swingMode === m}
                        disabled={!isOn || mutation.isPending}
                        onClick={() => {
                          setOverride({ ...override, swingMode: m });
                          run('set_swing_mode', { swing_mode: m }, 'Failed to set AC swing');
                        }}
                      />
                    ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* AC switches — clickable tonal tiles instead of switches */}
        {acSwitches.length > 0 && (
          <Box
            sx={{
              mt: 2.5,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 1.5,
              columnGap: 12,
            }}
          >
            {acSwitches.map((s) => {
              const isSwitchOn = switchOn[s.entity_id] ?? s.state === 'on';
              const n = friendlyName(s).toLowerCase();
              const Icon = n.includes('ilumin') ? Lightbulb : Power;
              return (
                <Box
                  key={s.entity_id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.5 }}
                >
                  <IconButton
                    aria-label={`Toggle ${friendlyName(s)}`}
                    onClick={() => toggleSwitch(s)}
                    disabled={mutation.isPending || s.state === 'unavailable'}
                    sx={{
                      width: 38,
                      height: 38,
                      p: 0,
                      bgcolor: isSwitchOn ? 'primary.main' : 'surface.variant',
                      color: isSwitchOn ? 'primary.contrastText' : 'text.disabled',
                      boxShadow: isSwitchOn ? '0 0 16px -6px #cba6f7' : 'none',
                      transition:
                        'background-color 200ms ease, color 200ms ease, box-shadow 200ms ease',
                      '&:hover': {
                        bgcolor: isSwitchOn ? 'primary.dark' : 'surface.default',
                      },
                    }}
                  >
                    <Icon size={18} />
                  </IconButton>
                  <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                    {friendlyName(s)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Sensor pills */}
        {acSensors.length > 0 && (
          <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {acSensors.map((s) => (
              <Box
                key={s.entity_id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  bgcolor: 'surface.variant',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1,
                  minWidth: 92,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ maxWidth: 110 }}
                >
                  {friendlyName(s).replace(/^ar[\s-]?condicionado\s*/i, '')}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {stateText(s)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Settings pills (schedule / sleep timer / notifications) */}
        {acOthers.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              Settings
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {acOthers.map((s) => (
                <Box
                  key={s.entity_id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    bgcolor: 'surface.variant',
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                    minWidth: 120,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ maxWidth: 150 }}
                  >
                    {friendlyName(s).replace(/^ar[\s-]?condicionado\s*/i, '')}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stateText(s)}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Dedicated panel for Pi-hole: status header, metric pills and clickable
 * switch tiles (writable via switch.* — same pattern as the AC panel).
 */
function PiholePanel({
  entities,
  mutation,
  onError,
}: {
  entities: HaEntity[];
  mutation: UseMutationResult<void, Error, ServiceCall, unknown>;
  onError: (message: string) => void;
}) {
  const statusEntity =
    entities.find((e) => e.entity_id.includes('status')) ??
    entities.find((e) => e.entity_id.startsWith('binary_sensor.'));
  const switches = entities.filter((e) => e.entity_id.startsWith('switch.'));
  const metricEntities = entities.filter(
    (e) =>
      e.entity_id.startsWith('sensor.') ||
      e.entity_id.startsWith('binary_sensor.'),
  );
  // Buttons and update checks are informational only — shown as plain pills.
  const infoEntities = entities.filter(
    (e) =>
      !e.entity_id.startsWith('switch.') &&
      !e.entity_id.startsWith('sensor.') &&
      !e.entity_id.startsWith('binary_sensor.'),
  );

  const [switchOn, setSwitchOn] = useState<Record<string, boolean>>({});
  const switchKey = switches.map((s) => `${s.entity_id}:${s.state}`).join('|');
  useEffect(() => {
    setSwitchOn({});
  }, [switchKey]);

  const unavailable = entities.every((e) => e.state === 'unavailable');
  const up =
    statusEntity != null &&
    (statusEntity.state === 'on' ||
      statusEntity.state === 'enabled' ||
      statusEntity.state === 'up');

  const toggleSwitch = (e: HaEntity) => {
    const next = (switchOn[e.entity_id] ?? e.state === 'on') ? false : true;
    setSwitchOn((prev) => ({ ...prev, [e.entity_id]: next }));
    mutation.mutate(
      { domain: 'switch', service: next ? 'turn_on' : 'turn_off', data: { entity_id: e.entity_id } },
      {
        onError: (err) => {
          setSwitchOn((prev) => ({ ...prev, [e.entity_id]: e.state === 'on' }));
          onError(`Failed to toggle ${friendlyName(e)}: ${err.message}`);
        },
      },
    );
  };

  const shortName = (e: HaEntity): string =>
    friendlyName(e)
      .replace(/^pi[\s_-]?hole\s*/i, '')
      .trim() || friendlyName(e);

  return (
    <Card>
      <CardContent sx={{ p: 3, opacity: unavailable ? 0.55 : 1 }}>
        {/* Header: Pi-hole icon + status */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: up ? 'primary.main' : 'surface.variant',
              color: up ? 'primary.contrastText' : 'text.disabled',
              boxShadow: up ? '0 0 16px -6px #cba6f7' : 'none',
            }}
          >
            <Server size={22} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              Pi-hole
            </Typography>
            <Typography
              variant="body2"
              color={up ? 'success.main' : 'text.secondary'}
              noWrap
            >
              {statusEntity
                ? up
                  ? friendlyName(statusEntity).replace(/^pi[\s_-]?hole\s*/i, '') + ' enabled'
                  : `${friendlyName(statusEntity).replace(/^pi[\s_-]?hole\s*/i, '')}: ${statusEntity.state}`
                : 'Pi-hole'}
            </Typography>
          </Box>
        </Box>

        {/* Metric pills */}
        {metricEntities.length > 0 && (
          <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {metricEntities
              .filter((e) => e !== statusEntity)
              .map((s) => (
                <Box
                  key={s.entity_id}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    bgcolor: 'surface.variant',
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                    minWidth: 110,
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ maxWidth: 140 }}
                  >
                    {shortName(s)}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {stateText(s)}
                  </Typography>
                </Box>
              ))}
          </Box>
        )}

        {/* Clickable switch tiles */}
        {switches.length > 0 && (
          <Box
            sx={{
              mt: 2.5,
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 1.5,
              columnGap: 12,
            }}
          >
            {switches.map((s) => {
              const isOn = switchOn[s.entity_id] ?? s.state === 'on';
              return (
                <Box
                  key={s.entity_id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.5 }}
                >
                  <IconButton
                    aria-label={`Toggle ${friendlyName(s)}`}
                    onClick={() => toggleSwitch(s)}
                    disabled={mutation.isPending || s.state === 'unavailable'}
                    sx={{
                      width: 38,
                      height: 38,
                      p: 0,
                      bgcolor: isOn ? 'primary.main' : 'surface.variant',
                      color: isOn ? 'primary.contrastText' : 'text.disabled',
                      boxShadow: isOn ? '0 0 16px -6px #cba6f7' : 'none',
                      transition:
                        'background-color 200ms ease, color 200ms ease, box-shadow 200ms ease',
                      '&:hover': {
                        bgcolor: isOn ? 'primary.dark' : 'surface.default',
                      },
                    }}
                  >
                    <Power size={18} />
                  </IconButton>
                  <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>
                    {shortName(s)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {/* Informational pills: buttons, updates */}
        {infoEntities.length > 0 && (
          <Box sx={{ mt: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {infoEntities.map((e) => (
              <Box
                key={e.entity_id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  bgcolor: 'surface.variant',
                  borderRadius: 2,
                  px: 1.5,
                  py: 1,
                  minWidth: 110,
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ maxWidth: 140 }}
                >
                  {shortName(e)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {stateText(e)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function HomeAssistant() {
  const statesQuery = useQuery({
    queryKey: ['ha', 'states'],
    queryFn: () => haClient.states(),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const configQuery = useQuery({
    queryKey: ['ha', 'config'],
    queryFn: () => haClient.config(),
    staleTime: Infinity,
  });

  // Lights + AC panel are the writable parts. onSettled refetches so cards and
  // the panel converge to server truth after each call.
  const serviceMutation = useMutation({
    mutationFn: (c: ServiceCall) => haClient.callService(c.domain, c.service, c.data),
    onSettled: () => {
      void statesQuery.refetch();
    },
  });
  const [notice, setNotice] = useState<string | null>(null);

  const states = statesQuery.data;
  const cfg = configQuery.data;

  const lights = useMemo(
    () =>
      (states ?? [])
        .filter((e) => e.entity_id.startsWith('light.'))
        .sort((a, b) => friendlyName(a).localeCompare(friendlyName(b))),
    [states],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, HaEntity[]>();
    const acList: HaEntity[] = [];
    const piholeList: HaEntity[] = [];
    for (const e of states ?? []) {
      const domain = e.entity_id.split('.')[0] ?? 'other';
      // Lights render as individual cards (see the Lights section below).
      if (domain === 'light') continue;
      // Nextcloud + the hidden domains are dropped from the dashboard.
      if (isNextcloud(e) || HIDDEN_DOMAINS.has(domain)) continue;
      // Air conditioners group together regardless of their domain.
      if (isAirConditioner(e)) {
        acList.push(e);
        continue;
      }
      // Pi-hole gets its own panel, also regardless of domain.
      if (isPihole(e)) {
        piholeList.push(e);
        continue;
      }
      const key = (DOMAIN_ORDER as readonly string[]).includes(domain) ? domain : 'other';
      const arr = map.get(key);
      if (arr) arr.push(e);
      else map.set(key, [e]);
    }
    const ordered = [...DOMAIN_ORDER, 'other']
      .filter((d) => (map.get(d)?.length ?? 0) > 0)
      .map((d) => ({
        title: DOMAIN_LABELS[d] ?? d,
        entities: map.get(d) ?? [],
        wide: false as const,
      }));
    return [
      ...(acList.length > 0
        ? [{ title: 'Air Conditioners', entities: acList, wide: true as const }]
        : []),
      ...(piholeList.length > 0
        ? [{ title: 'Pi-hole', entities: piholeList, wide: true as const }]
        : []),
      ...ordered,
    ];
  }, [states]);

  const total = states?.length ?? 0;

  const loading = statesQuery.isLoading;
  const refreshing = statesQuery.isFetching && !loading;
  const error = statesQuery.error;

  const handleRefresh = () => {
    void statesQuery.refetch();
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
            Home Assistant
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body1" color="text.secondary">
              {cfg?.location_name ?? '—'}
              {cfg?.version ? ` · v${cfg.version}` : ''}
            </Typography>
            <Chip
              icon={<ShieldCheck size={14} />}
              label="Lights + AC + Pi-hole switches controllable · rest read-only"
              size="small"
              color="default"
              variant="outlined"
            />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ConnectionBadge status={statesQuery.status} refreshing={refreshing} />
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
            {statesQuery.dataUpdatedAt
              ? new Date(statesQuery.dataUpdatedAt).toLocaleTimeString()
              : '—'}
          </Typography>
        </Box>
      </Box>

      {loading && <LinearProgress />}
      {error && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body1" color="error.main">
              Unable to fetch Home Assistant data.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {error instanceof Error ? error.message : String(error)}
              {error instanceof HaApiError &&
                error.status === 401 &&
                ' — check VITE_HA_URL and VITE_HA_TOKEN in .env'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Lights — grid of compact M3 control cards */}
      {lights.length > 0 && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 1.5 }}>
            Lights
          </Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                lg: 'repeat(3, 1fr)',
              },
            }}
          >
            {lights.map((e) => (
              <LightCard
                key={e.entity_id}
                entity={e}
                mutation={serviceMutation}
                onError={(m) => setNotice(m)}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Entity groups */}
      <Box
        sx={{
          display: 'grid',
          gap: 3,
          mt: 3,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
        }}
      >
        {grouped.map((g) =>
          g.wide && g.title === 'Air Conditioners' ? (
            <Box key={g.title} sx={{ gridColumn: '1 / -1' }}>
              <AirConditionerPanel
                entities={g.entities}
                mutation={serviceMutation}
                onError={(m) => setNotice(m)}
              />
            </Box>
          ) : g.wide && g.title === 'Pi-hole' ? (
            <Box key={g.title} sx={{ gridColumn: '1 / -1' }}>
              <PiholePanel
                entities={g.entities}
                mutation={serviceMutation}
                onError={(m) => setNotice(m)}
              />
            </Box>
          ) : (
            <GroupCard key={g.title} title={g.title} entities={g.entities} />
          ),
        )}
      </Box>

      {!loading && total === 0 && (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No entities returned — the token may lack read access to states.
          </Typography>
        </Box>
      )}

      <Snackbar
        open={notice !== null}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        message={notice}
      />
    </Box>
  );
}
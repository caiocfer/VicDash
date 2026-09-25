import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Switch from '@mui/material/Switch';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

import { haClient } from '../services/haClient';
import {
  friendlyName,
  isAirConditioner,
  isNextcloud,
  isPihole,
} from '../services/haHelpers';
import {
  isSensorVisible,
  loadPreferences,
  savePreferences,
  type HaPreferences,
} from '../services/haPreferences';
import type { HaEntity } from '../types/homeAssistant';

const REFRESH_INTERVAL_MS = 60_000;

/**
 * Settings page for the Home Assistant dashboard: toggle which sensors appear
 * on the main page. Preferences are persisted in localStorage, so this will
 * grow into a general "what shows on the panel" control later.
 */
export default function HomeAssistantSettings() {
  const statesQuery = useQuery({
    queryKey: ['ha', 'states'],
    queryFn: () => haClient.states(),
    refetchInterval: REFRESH_INTERVAL_MS,
  });
  const [prefs, setPrefs] = useState<HaPreferences>(() => loadPreferences());

  const sensors = useMemo(
    () =>
      (statesQuery.data ?? [])
        .filter(
          (e: HaEntity) =>
            e.entity_id.startsWith('sensor.') &&
            !isPihole(e) &&
            !isNextcloud(e) &&
            !isAirConditioner(e),
        )
        .sort((a, b) => friendlyName(a).localeCompare(friendlyName(b))),
    [statesQuery.data],
  );

  const visibleCount = sensors.filter((s) =>
    isSensorVisible(prefs, s.entity_id),
  ).length;

  const toggle = (entityId: string) => {
    const next = { ...prefs, [entityId]: !isSensorVisible(prefs, entityId) };
    setPrefs(next);
    savePreferences(next);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Toolbar disableGutters sx={{ mb: 1 }}>
        <IconButton
          aria-label="Back to Home Assistant"
          component={Link}
          to="/home-assistant"
          sx={{ mr: 1.5, color: 'text.secondary' }}
        >
          <ArrowLeft size={20} />
        </IconButton>
        <Box>
          <Typography variant="h4" color="text.primary">
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Home Assistant — choose which sensors appear on the dashboard
            ({visibleCount}/{sensors.length} visible)
          </Typography>
        </Box>
      </Toolbar>

      {statesQuery.isLoading && <LinearProgress />}

      {sensors.length > 0 && (
        <Card>
          <Divider />
          <CardContent sx={{ px: 0, py: 0 }}>
            <List dense disablePadding>
              {sensors.map((s) => {
                const on = isSensorVisible(prefs, s.entity_id);
                return (
                  <ListItem
                    key={s.entity_id}
                    secondaryAction={
                      <Switch
                        edge="end"
                        checked={on}
                        onChange={() => toggle(s.entity_id)}
                        size="small"
                      />
                    }
                    divider
                    sx={{ px: 2 }}
                  >
                    <ListItemText
                      primary={friendlyName(s)}
                      secondary={s.entity_id}
                      primaryTypographyProps={{ fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                );
              })}
            </List>
          </CardContent>
        </Card>
      )}

      {!statesQuery.isLoading && sensors.length === 0 && (
        <Typography variant="body1" color="text.secondary">
          No sensors found.
        </Typography>
      )}
    </Box>
  );
}
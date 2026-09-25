import type { HaEntity } from '../types/homeAssistant';

/** States counted as "active" for the quick status / summary views. */
export const ACTIVE_STATES = new Set([
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

export const UNAVAILABLE_STATES = new Set(['unavailable', 'unknown']);

/** Friendly display name, falling back to the raw entity_id. */
export const friendlyName = (e: HaEntity): string =>
  typeof e.attributes.friendly_name === 'string' && e.attributes.friendly_name
    ? e.attributes.friendly_name
    : e.entity_id;

/**
 * Matches air-conditioner entities by name: "ar-condicionado" / "ar
 * condicionado" / "air condition(er)" / the AC acronym. Checks both the
 * friendly name and the entity_id (e.g. `ar_condicionado_power`).
 */
export const isAirConditioner = (e: HaEntity): boolean =>
  /ar[\s-]?condicionado|air[\s-]?condition|a\.c\.|(^|[\s_-])ac([\s_-]|$)/i.test(
    `${e.entity_id} ${friendlyName(e)}`,
  );

/**
 * Matches Pi-hole entities by name: "pi-hole" / "pi_hole" / "pihole"
 * in either the entity_id or the friendly name.
 */
export const isPihole = (e: HaEntity): boolean =>
  /pi[\s_-]?hole|pihole/i.test(`${e.entity_id} ${friendlyName(e)}`);

/**
 * Matches Nextcloud entities (dropped from the dashboard for now).
 * Everything from the discovery is named `nextcloud_caiocfer_duckdns_org_*`.
 */
export const isNextcloud = (e: HaEntity): boolean =>
  /nextcloud/i.test(`${e.entity_id} ${friendlyName(e)}`);

/** Rich state text with units / brightness / temperature where available. */
export function stateText(e: HaEntity): string {
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
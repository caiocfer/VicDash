/**
 * User preferences for what appears on the Home Assistant dashboard.
 * Stored in localStorage; the settings page (`/home-assistant/settings`)
 * toggles sensor visibility here. Kept as a plain key → boolean map so it
 * can later grow to cover other entity kinds.
 */
export type HaPreferences = Record<string, boolean>;

const PREFS_KEY = 'vicdash.ha.preferences';

/** Load preferences from localStorage (empty object on any failure). */
export function loadPreferences(): HaPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: HaPreferences = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist preferences to localStorage (swallows storage failures). */
export function savePreferences(prefs: HaPreferences): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* private mode / quota — non-fatal */
  }
}

/**
 * Whether a sensor entity is visible on the dashboard. Sensors default to
 * visible; the settings page sets `false` for the ones to hide.
 */
export function isSensorVisible(
  prefs: HaPreferences,
  entityId: string,
): boolean {
  return prefs[entityId] !== false;
}
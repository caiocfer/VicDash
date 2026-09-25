import type { HaEntity, HaServerConfig } from '../types/homeAssistant';

/**
 * Runtime configuration for the Home Assistant client, read from Vite env vars
 * (prefixed with `VITE_` so they are safely bundled into the client):
 *
 *   VITE_HA_URL         - upstream Home Assistant base URL. In dev the Vite
 *                         dev server proxies `/vicdash-ha` to this URL
 *                         (see vite.config.ts).
 *   VITE_HA_TOKEN       - long-lived access token. Create one in Home
 *                         Assistant: Profile > Security > Long-lived access
 *                         tokens. Read-only: this dashboard never calls
 *                         services, so a token without write rights is fine.
 *   VITE_HA_PROXY_BASE  - base path the client calls. Defaults to the
 *                         same-origin `/vicdash-ha` (works with the dev
 *                         proxy). Set to an absolute URL only if your
 *                         production web server already proxies the API.
 */
export interface HaClientConfig {
  baseUrl: string;
  token: string;
}

export function loadHaConfig(): HaClientConfig {
  const baseUrl = (import.meta.env.VITE_HA_PROXY_BASE ?? '/vicdash-ha').replace(/\/$/, '');
  const token = import.meta.env.VITE_HA_TOKEN ?? '';
  return { baseUrl, token };
}

/**
 * Client for the Home Assistant REST API.
 * Read-only everywhere except the dashboard controls: `callService` is the
 * only mutating method and is used solely for `light.*`, `climate.*` and
 * `switch.*` (AC panel) services.
 */
export class HaClient {
  private readonly options: HaClientConfig;

  constructor(config: HaClientConfig = loadHaConfig()) {
    this.options = config;
  }

  /** All entity states: `GET /api/states`. */
  async states(): Promise<HaEntity[]> {
    const res = await fetch(`${this.options.baseUrl}/api/states`, {
      method: 'GET',
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new HaApiError(res.status, `Home Assistant states failed (${res.status})`);
    }
    return (await res.json()) as HaEntity[];
  }

  /** Server info: `GET /api/config`. */
  async config(): Promise<HaServerConfig> {
    const res = await fetch(`${this.options.baseUrl}/api/config`, {
      method: 'GET',
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new HaApiError(res.status, `Home Assistant config failed (${res.status})`);
    }
    return (await res.json()) as HaServerConfig;
  }

  /**
   * Call a Home Assistant service — used ONLY for the dashboard controls:
   * lights (`light.turn_on` / `light.turn_off`, brightness via
   * `brightness_pct`) and the air-conditioner panel (`climate.set_*`,
   * `switch.turn_on` / `switch.turn_off`). Everything else stays read-only.
   */
  async callService(
    domain: string,
    service: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const res = await fetch(`${this.options.baseUrl}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: this.authHeaders('application/json'),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new HaApiError(
        res.status,
        `Home Assistant service call failed (${res.status})${detail ? `: ${detail}` : ''}`,
      );
    }
  }

  private authHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`;
    }
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    return headers;
  }
}

/** Error thrown for non-2xx Home Assistant responses. */
export class HaApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'HaApiError';
    this.status = status;
  }
}

/** Shared singleton backed by the Vite-provided environment configuration. */
export const haClient = new HaClient();
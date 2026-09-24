import type {
  GrafanaDatasourceRef,
  GrafanaHealthResponse,
  GrafanaQueryModel,
  GrafanaQueryPayload,
  GrafanaQueryResults,
  GrafanaTimeRange,
} from '../types/grafana';

/**
 * Runtime configuration for the Grafana client.
 *
 * Values are read from Vite environment variables (prefixed with `VITE_` so they
 * are safely bundled into the client). Sensible defaults are provided so the
 * app still boots in a local/offline state.
 *
 *   VITE_GRAFANA_URL         - upstream Grafana base URL. In dev, the Vite
 *                              dev server proxies `/vicdash-api` to this URL
 *                              (see vite.config.ts), so this is the target the
 *                              proxy forwards to.
 *   VITE_GRAFANA_TOKEN       - bearer token used for `Authorization`
 *   VITE_GRAFANA_DSUID       - default datasource UID (optional; empty routes to
 *                              Grafana's single/default datasource)
 *   VITE_GRAFANA_PROXY_BASE  - base path the client calls. Defaults to the
 *                              same-origin `/vicdash-api` (works with the dev
 *                              proxy). Set to an absolute URL only if your
 *                              production web server already proxies the API.
 */
export interface GrafanaConfig {
  baseUrl: string;
  token: string;
  datasourceUid: string;
}

export function loadGrafanaConfig(): GrafanaConfig {
  // Same-origin relative base: in dev this hits the Vite proxy (no CORS), and in
  // production it works when the web server proxies the same path upstream.
  const baseUrl = (
    import.meta.env.VITE_GRAFANA_PROXY_BASE ?? '/vicdash-api'
  ).replace(/\/$/, '');
  const token = import.meta.env.VITE_GRAFANA_TOKEN ?? '';
  // Empty by design: when unset, queries route to Grafana's single/default datasource.
  const datasourceUid = (import.meta.env.VITE_GRAFANA_DSUID ?? '').replace(/^\s+|\s+$/g, '');
  return { baseUrl, token, datasourceUid };
}

/**
 * Thin client for the Grafana HTTP API, backed by VictoriaMetrics.
 *
 * All network access goes through `fetch`; the client is framework-agnostic and
 * is consumed by `@tanstack/react-query` hooks in the UI layer.
 */
export class GrafanaClient {
  private readonly config: GrafanaConfig;
  /** Cached datasource reference resolved once per client instance. */
  private datasourceRef: GrafanaDatasourceRef | null = null;

  constructor(config: GrafanaConfig = loadGrafanaConfig()) {
    this.config = config;
  }

  /** Absolute base URL for API calls (sans trailing slash). */
  get apiUrl(): string {
    return this.config.baseUrl;
  }

  /** Health check: `GET /api/health`. */
  async health(): Promise<GrafanaHealthResponse> {
    const res = await fetch(`${this.config.baseUrl}/api/health`, {
      method: 'GET',
      headers: this.authHeaders(),
    });

    if (!res.ok) {
      throw new GrafanaApiError(res.status, `Health check failed (${res.status})`);
    }

    return (await res.json()) as GrafanaHealthResponse;
  }

  /**
   * Resolves the datasource reference attached to every query.
   *
   * Grafana's `/api/ds/query` requires an explicit datasource identifier even
   * when a single/default datasource exists, so we resolve it:
   *   - If `VITE_GRAFANA_DSUID` is set, use that uid (type assumed prometheus).
   *   - Otherwise, list `/api/datasources` and use Grafana's default datasource.
   *
   * The result is cached on the instance.
   */
  async resolveDatasource(): Promise<GrafanaDatasourceRef> {
    if (this.datasourceRef) return this.datasourceRef;

    if (this.config.datasourceUid) {
      this.datasourceRef = { type: 'prometheus', uid: this.config.datasourceUid };
      return this.datasourceRef;
    }

    const res = await fetch(`${this.config.baseUrl}/api/datasources`, {
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      throw new GrafanaApiError(
        res.status,
        `Unable to resolve default datasource (${res.status})`,
      );
    }

    const list = (await res.json()) as Array<{
      type: string;
      uid: string;
      isDefault?: boolean;
    }>;
    const def = list.find((d) => d.isDefault) ?? list[0];
    if (!def) {
      throw new GrafanaApiError(500, 'No datasource found in Grafana');
    }
    this.datasourceRef = { type: def.type, uid: def.uid };
    return this.datasourceRef;
  }

  /**
   * Execute one or more PromQL-style queries in a single request.
   * Mirrors `POST /api/ds/query`.
   */
  async query(
    queries: GrafanaQueryModel[],
    timeRange: GrafanaTimeRange,
    options: { timezone?: string } = {},
  ): Promise<GrafanaQueryResults> {
    const datasource = await this.resolveDatasource();
    const payload: GrafanaQueryPayload = {
      // Grafana's `/api/ds/query` rejects raw epoch numbers and requires
      // time values as strings (relative or ISO 8601).
      from: toGrafanaTime(timeRange.from),
      to: toGrafanaTime(timeRange.to),
      queries: queries.map((q) => ({
        refId: q.refId,
        // Grafana's Prometheus datasource reads the expression from `expr`.
        expr: q.query,
        datasource,
      })),
      timezone: options.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const res = await fetch(`${this.config.baseUrl}/api/ds/query`, {
      method: 'POST',
      headers: this.authHeaders('application/json'),
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new GrafanaApiError(
        res.status,
        `Grafana query failed (${res.status})${detail ? `: ${detail}` : ''}`,
      );
    }

    const data = (await res.json()) as GrafanaQueryResults;

    // Backend returns a JSON envelope with an `error` field on failure.
    if (data.error) {
      throw new GrafanaApiError(500, data.error);
    }

    return data;
  }

  private authHeaders(contentType = 'application/json'): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      Accept: 'application/json',
    };
    if (this.config.token) {
      headers.Authorization = `Bearer ${this.config.token}`;
    }
    return headers;
  }
}

/** Error thrown for non-2xx Grafana responses. */
export class GrafanaApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GrafanaApiError';
    this.status = status;
  }
}

/** Shared singleton backed by the Vite-provided environment configuration. */
export const grafanaClient = new GrafanaClient();

/**
 * Grafana's `/api/ds/query` requires `from`/`to` as strings (relative like
 * `now-2d` or ISO 8601); raw epoch numbers are rejected with a 400. Numeric
 * inputs (e.g. `Date.now()`) are serialized to ISO 8601, strings pass through.
 */
export function toGrafanaTime(value: string | number): string {
  return typeof value === 'number' ? new Date(value).toISOString() : value;
}

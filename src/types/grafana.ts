/**
 * TypeScript interfaces for the Grafana HTTP API data-query model
 * (`POST /api/ds/query`), as returned by a VictoriaMetrics Grafana-compatible
 * backend. See: https://grafana.com/docs/grafana/latestdevelopers/http_api/
 */

/** A single field (column) definition inside a Grafana data frame. */
export interface GrafanaFieldSchema {
  name: string;
  /** Primitive type: 'string' | 'time' | 'double' | 'number' | 'boolean' | ... */
  type: string;
  typeInfo: { frame: string };
  config?: Record<string, unknown>;
  /**
   * Series label set attached to a value field (Prometheus label set).
   * Present on every value column; for label-only/constant metrics the useful
   * data lives here rather than in the numeric values.
   */
  labels?: Record<string, string>;
}

/** A datasource reference to attach to a query payload. */
export interface GrafanaDatasourceRef {
  type: string;
  uid: string;
}

/** A Grafana data frame: schema + typed column values. */
export interface GrafanaDataFrames {
  /** Optional frame name (used by some VictoriaMetrics queries). */
  name?: string;
  refId?: string;
  schema: {
    fields: GrafanaFieldSchema[];
    /** Total number of rows across all columns. */
    length: number;
  };
  data: {
    /** Each entry is a column: an array of scalar values. */
    values: unknown[][];
  };
}

/** The `A`/`B`/... keyed result for a single query refId. */
export interface GrafanaQueryResult {
  refId: string;
  /** Optional metadata returned by the backend. */
  meta?: {
    type?: string;
    limit?: number;
    partial?: boolean;
    [key: string]: unknown;
  };
  frames: GrafanaDataFrames[];
}

/** The full `/api/ds/query` response body. */
export interface GrafanaQueryResults {
  results: {
    [refId: string]: GrafanaQueryResult;
  };
  /** Top-level error payload when the backend returns a non-2xx. */
  error?: string;
  message?: string;
  status?: string;
}

/** Absolute time window for a query (`from`/`to` as ISO string or epoch ms). */
export interface GrafanaTimeRange {
  from: string | number;
  to: string | number;
}

/** A single query as sent in the `queries` array of `/api/ds/query`. */
export interface GrafanaQueryModel {
  refId: string;
  /**
   * App-level name for the PromQL expression. The Grafana payload field is
   * `expr` (see {@link GrafanaQueryModel.expr}); {@link GrafanaClient} maps
   * `query` -> `expr` when building the request.
   */
  query: string;
  /** Grafana payload field for the expression (populated by the client). */
  expr?: string;
  /** Datasource reference to attach to the payload (populated by the client). */
  datasource?: GrafanaDatasourceRef;
  /**
   * Deprecated in favor of `datasource`. Retained for backwards compatibility.
   * An empty UID does not work with `/api/ds/query` — the client resolves the
   * default datasource instead.
   */
  datasourceUid?: string;
  /** Query interval in ms (e.g. 15000). */
  interval?: number;
  /** Start epoch ms (optional when `from` is provided). */
  start?: string | number;
  /** End epoch ms (optional when `to` is provided). */
  end?: string | number;
  /** Max number of series to return. */
  maxDataPoints?: number;
  /** Ad-hoc filter placeholders. */
  filters?: Array<Record<string, unknown>>;
}

/** A single query item as serialized into the `/api/ds/query` payload. */
export interface GrafanaQueryPayloadItem {
  refId: string;
  /** Grafana payload field for the expression. */
  expr?: string;
  /** Datasource reference to attach to the payload. */
  datasource?: GrafanaDatasourceRef;
}

/** Payload for `POST /api/ds/query`. */
export interface GrafanaQueryPayload {
  from: string | number;
  to: string | number;
  queries: GrafanaQueryPayloadItem[];
  timezone?: string;
}

/** Response of `GET /api/health`. */
export interface GrafanaStatusModel {
  database: string;
  version: string;
}

export interface GrafanaHealthResponse {
  message?: string;
  database: string;
  version: string;
}

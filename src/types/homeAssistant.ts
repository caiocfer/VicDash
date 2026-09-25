/** One entity's state from `GET /api/states`. */
export interface HaEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

/** Server info from `GET /api/config`. */
export interface HaServerConfig {
  location_name?: string;
  version?: string;
  [key: string]: unknown;
}
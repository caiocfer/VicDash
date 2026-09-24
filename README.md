# VicDash

A modern, personal dashboard that monitors system metrics, GPU health, and home automation state — built with **React 19 + Vite + TypeScript**, querying the **Grafana HTTP API** backed by **VictoriaMetrics**.

![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178c6)
![MUI](https://img.shields.io/badge/Material%20UI-6-89b4fa)
![License](https://img.shields.io/badge/License-PolyForm%20Noncommercial%201.0.0-cc9)

## Features

- **Overview dashboard** with live data:
  - **System Summary** — hostname, OS/kernel, architecture, CPU thread count, uptime
  - **GPU Snapshot** — model, total VRAM, current memory usage + temperature
  - **Home Assistant Quick Status** — placeholder, integration planned for a later phase
- **GPU dashboard** (`/gpu`) with live data:
  - Stat cards: utilization, temperature, fan speed, power draw, VRAM used / total
  - VRAM usage bar and per-process table (SM %, VRAM, PID(s))
  - 15-minute history charts: utilization, power, temperature, VRAM (recharts)
- **Live connection badge** + real error messages instead of silent failures
- **Auto-refresh every 60 s** with a manual refresh button and "last updated" timestamp
- **Material Design 3** UI with the Catppuccin Mocha palette (dark)
- **Responsive navigation** — desktop: icon-only collapsible rail (state remembered in `localStorage`); mobile: slide-in drawer with working close

## Tech Stack

| Layer        | Choice                                              |
| ------------ | --------------------------------------------------- |
| Framework    | React 19 + Vite 8 + TypeScript 6                    |
| UI           | Material UI v6 (M3) + `lucide-react`                |
| Data         | `@tanstack/react-query` (live polling)              |
| Charts       | `recharts` (GPU history charts)                     |
| Backend      | Grafana HTTP API (`POST /api/ds/query`) → VictoriaMetrics |

## Getting Started

### 1. Configuration

Copy `.env.example` to `.env` and fill in your values:

```bash
VITE_GRAFANA_URL=http://host.docker.internal:30001   # upstream Grafana (dev proxy target)
VITE_GRAFANA_TOKEN=glsa_xxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Grafana service-account token (required)
VITE_GRAFANA_DSUID=                                  # leave empty to use Grafana's default datasource
```

> ⚠️ `.env` is gitignored. The token is a secret — never commit it.

### 2. Run

```bash
npm install
npm run dev        # Vite dev server
```

The dev server proxies `/vicdash-api/*` to Grafana (see `vite.config.ts`), which sidesteps CORS. Requests are server-to-server, so browser `Origin`/`Referer` headers are stripped before forwarding.

### Docker development

```bash
docker compose up -d
```

The container reaches the host's Grafana via `host.docker.internal` (`extra_hosts` in `docker-compose.yml`). The workspace is bind-mounted for HMR.

### Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Vite dev server with HMR             |
| `npm run build`   | Type-check (`tsc -b`) + production build |
| `npm run lint`    | Oxlint                               |
| `npm run preview` | Preview the production build         |

## Architecture Notes

- Queries are written as PromQL expressions and mapped to Grafana's `expr` field (the client sets the datasource ref to Grafana's default datasource at runtime).
- Grafana's `/api/ds/query` requires `from`/`to` as ISO strings — the client serializes them automatically.
- All API access goes through `src/services/grafanaClient.ts`.

## Project Status

- ✅ Phase 1 (Overview) — complete
- ✅ Phase 2 (GPU dashboard) — complete
- ⏳ Planned: CPU and Home Assistant pages

## License

[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)

Copyright © 2026 Caio Cesar Ferreira

Personal use, research, and hobby projects are welcome — **commercial use is not permitted** without permission.
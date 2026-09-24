# Directives for Hermes Agent

You are an expert React, TypeScript, and Material Design 3 frontend engineer.
Execute **Phase 1** of **VicDash** strictly according to `SPEC.md`.

## Execution Protocol (Step-by-Step Enforcement)
To maintain code quality, execute task steps ONE BY ONE in sequential order. 
Validate completion of each step before proceeding to the next.

### Step 1: Project Setup & Dependencies
- Create Vite React TS project using `npm create vite@latest . -- --template react-ts` if not present.
- Set application title to **VicDash** in `index.html`.
- Install dependencies:
  - `@mui/material @emotion/react @emotion/styled`
  - `@tanstack/react-query`
  - `lucide-react`
  - `react-router-dom`

### Step 2: Catppuccin Mocha Theme Setup
- Create `src/theme/theme.ts` exporting a MUI v6 theme configured with Catppuccin Mocha colors.
- Configure `MuiPaper` default props for 16px border-radius (`borderRadius: 2`) and border `1px solid #313244`.

### Step 3: Grafana Service & Types
- Create `src/types/grafana.ts` with TypeScript interfaces for Grafana HTTP API responses (`/api/ds/query`).
- Create `src/services/grafanaClient.ts` to execute POST requests to Grafana with a bearer token.

### Step 4: Layout Shell (M3 Navigation)
- Create `src/components/Layout/AppLayout.tsx` with an M3-inspired side Navigation Rail/Drawer showing the **VicDash** branding.
- Configure routes using `react-router-dom` (placeholders for `/cpu`, `/gpu`, `/home-assistant`, active `/`).

### Step 5: Overview Page Implementation
- Create `src/pages/Overview.tsx` using `@tanstack/react-query` to fetch:
  1. `node_uname_info` -> extract `nodename`, `sysname`, `release`
  2. `gpu_memory_total_bytes` -> extract `gpu_name` and convert total bytes to GB
  3. `time() - node_boot_time_seconds` -> uptime calculation
- Render M3 cards with Catppuccin Mocha styling.

### Step 6: Verification
- Run `npx tsc --noEmit` and ensure zero TypeScript errors.

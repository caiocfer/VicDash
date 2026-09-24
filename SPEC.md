# VicDash — VictoriaMetrics & Home Dashboard Specification

## Goal
Build a modern, custom React dashboard in TypeScript named **VicDash** to monitor system metrics, GPU health, and home automation state by querying the Grafana HTTP API backed by VictoriaMetrics.

## Tech Stack & Tooling
- **Framework & Bundler:** React 19 + Vite + TypeScript
- **UI System:** Material Design 3 (M3) via `@mui/material` v6
- **Theme Palette:** Catppuccin Mocha (Dark theme by default)
- **Data Fetching:** `@tanstack/react-query` for asynchronous state management and polling
- **Metrics Source:** Grafana HTTP API (`POST /api/ds/query`) backed by VictoriaMetrics Cluster

## Monitoring Stack Metrics Mapping
The backend infrastructure runs a Helm stack with VictoriaMetrics and custom exporters.

### Confirmed Metrics Mapping for Phase 1 (Overview):
1. **Host & OS Info:**
   - Query: `node_uname_info`
   - Target Labels: `nodename` (e.g., "caio-cachyos"), `sysname` ("Linux"), `release` ("7.2.6-1-cachyos"), `machine` ("x86_64")
2. **CPU Count:**
   - Query: `count(count(node_cpu_seconds_total) by (cpu))`
   - Target Value: Integer count of available CPU cores/threads
3. **GPU Hardware Info:**
   - Query: `gpu_memory_total_bytes`
   - Target Labels: `gpu_name` (e.g., "NVIDIA GeForce RTX 2060 SUPER")
   - Target Value: Total VRAM in bytes (convert to GB)
4. **Host Uptime:**
   - Query: `time() - node_boot_time_seconds`
   - Target Value: System uptime in seconds (format to days/hours/minutes)

## Target Scope (Phase 1: Overview Only)
Build **ONLY** the layout shell and the **`/` (Overview)** route.

### Overview Page Deliverables:
1. **System Summary Card:** Hostname, OS/Kernel info, CPU thread count, and uptime.
2. **GPU Snapshot Card:** GPU Model Name dynamically extracted from label `gpu_name` and total VRAM.
3. **Home Assistant Quick Status:** Placeholder card ready for future HA integration.

## Design Rules (Catppuccin Mocha + M3)
- Background Base: `#1e1e2e`
- Card/Surface (Mantle): `#181825`
- Borders/Divides (Surface0): `#313244`
- Text Primary: `#cdd6f4`
- Text Secondary: `#a6adc8`
- Primary Accent (Mauve): `#cba6f7`
- Secondary Accent (Blue): `#89b4fa`
- Success (Green): `#a6e3a1`
- Warning (Peach): `#fab387`
- Error (Red): `#f38ba8`
- Card corner radius: `16px` (`borderRadius: 2` in MUI)

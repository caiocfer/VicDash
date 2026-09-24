# GPU Dashboard Triage — Nvidia GPU Exporter

Source: Grafana dashboard "Nvidia GPU Exporter" (`uid 0834e7f4-…`, declarative format v2).
Datasource: `P4169E866C3094E38` (Prometheus → VictoriaMetrics). Job: `monitoring-stack-gpu-exporter` — metrics are unique to this job, so queries can use bare metric names.

## Metric inventory (8 unique metrics, 14 Grafana panels)

| Metric | Unit | Current | Grafana panels (stat / line) |
|---|---|---|---|
| `gpu_utilization_percent` | % | 22 | Usage % (stat) + Total Usage (line) — duplicate expr |
| `gpu_power_usage_milliwatts` | mW (÷1000 → W) | 28146 → 28.1 W | Power (stat) + Watt Usage (line) — duplicate |
| `gpu_temperature_celsius` | °C | 43 | Temperature (stat) only |
| `gpu_fan_speed_percent` | % | 0 | Fan Speed (stat) + "Fan Speed Percentage" (line, mislabeled) |
| `gpu_memory_usage_bytes` | bytes (→ GiB) | 3.23 GiB | Memory Used (stat) + (line) — duplicate |
| `gpu_memory_total_bytes` | bytes (→ GiB) | 8 GiB | Total Memory (stat) only |
| `gpu_process_sm_utilization_percent` | % | llama-server 42 | PID chart + Process-Name chart — same data, two groupings |
| `gpu_process_memory_bytes` | bytes (→ GiB) | llama-server 2.03 GiB | PID chart + By-Name chart — same data, two groupings |

Labels on GPU metrics: `gpu_id=0`, `gpu_name="NVIDIA GeForce RTX 2060 SUPER"`, `gpu_uuid=…`. Process metrics add `pid` + `process_name`.

## Queries for VicDash

```text
# GPU-level (stat cards)
gpu_utilization_percent                      # %
gpu_temperature_celsius                      # °C
gpu_fan_speed_percent                        # % (0 = fans off at idle)
gpu_power_usage_milliwatts                   # /1000 → W
gpu_memory_usage_bytes                       # /1024^3 → GiB used
gpu_memory_total_bytes                       # /1024^3 → GiB total

# Per-process (aggregate client-side)
gpu_process_sm_utilization_percent           # group by process_name: max %
gpu_process_memory_bytes                     # group by process_name: sum → GiB
```

## Planned → build when ready (`/gpu` page)

1. **Stat row (6 cards):** Utilization %, Temperature °C, Fan % ("Off" when 0), Power W, VRAM used, VRAM total.
2. **VRAM progress bar:** used vs total + percentage.
3. **Process table:** process_name | max SM % | VRAM GiB | PID(s) — sorted by utilization.
4. **History charts** (needs a chart lib, e.g. recharts — currently none): utilization, power, temperature, VRAM over time.

## Notes / gotchas

- Panel-12 "GPU Total Usage Percent" is not a cross-GPU total: `sum by (gpu_uuid)` keeps per-GPU series. Harmless with one GPU.
- Per-process SM% may out-sum the GPU's own % (overlapping sampling windows) — display as-is, do not reconcile.
- No `$process_name` variable needed in VicDash: query all series, aggregate in the client.
- Time windows: use short ranges for stat cards (e.g. `now-15m`) so the last sample is current — long ranges (2 d) step-lag by ~40 min (see uptime fix).
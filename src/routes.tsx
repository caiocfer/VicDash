import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import PlaceholderPage from './components/PlaceholderPage';
import Overview from './pages/Overview';
import { Cpu, Gauge, Home } from 'lucide-react';

/**
 * Application route table for Phase 1.
 * - `/` is the active Overview page.
 * - `/cpu`, `/gpu`, `/home-assistant` are placeholders for later phases.
 */
export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Overview />} />
        <Route
          path="/cpu"
          element={
            <PlaceholderPage
              title="CPU"
              description="Per-core and aggregate CPU utilization will appear here."
              icon={Cpu}
            />
          }
        />
        <Route
          path="/gpu"
          element={
            <PlaceholderPage
              title="GPU"
              description="GPU utilization, temperature and VRAM charts will appear here."
              icon={Gauge}
            />
          }
        />
        <Route
          path="/home-assistant"
          element={
            <PlaceholderPage
              title="Home Assistant"
              description="Home automation state and controls will appear here."
              icon={Home}
            />
          }
        />
      </Route>
    </Routes>
  );
}

/** Mounts the router. Providers are applied in `main.tsx`. */
export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

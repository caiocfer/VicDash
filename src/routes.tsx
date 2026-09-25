import { BrowserRouter, Route, Routes } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import PlaceholderPage from './components/PlaceholderPage';
import Overview from './pages/Overview';
import Gpu from './pages/Gpu';
import HomeAssistant from './pages/HomeAssistant';
import { Cpu } from 'lucide-react';

/**
 * Application route table.
 * - `/` Overview, `/gpu` GPU, `/home-assistant` Home Assistant: live pages.
 * - `/cpu` is a placeholder for a later phase.
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
            <Gpu />
          }
        />
        <Route
          path="/home-assistant"
          element={
            <HomeAssistant />
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

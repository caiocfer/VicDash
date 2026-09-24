import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Toolbar from '@mui/material/Toolbar';
import { useTheme } from '@mui/material';
import {
  LayoutDashboard,
  Cpu,
  Gauge,
  Home,
  Database,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

/** Top-level navigation entries. `/` is active by default per the SPEC. */
export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', to: '/', icon: LayoutDashboard },
  { label: 'CPU', to: '/cpu', icon: Cpu },
  { label: 'GPU', to: '/gpu', icon: Gauge },
  { label: 'Home Assistant', to: '/home-assistant', icon: Home },
];

const BRAND = 'VicDash';
const DRAWER_WIDTH = 264;
const COLLAPSED_WIDTH = 76;
const COLLAPSED_STORAGE_KEY = 'vicdash.nav.collapsed';

/** The branded logo mark shown at the top of the nav rail. */
function BrandMark() {
  return (
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: '8px',
        background:
          'linear-gradient(135deg, rgb(203,166,247) 0%, rgb(137,180,250) 100%)',
        flexShrink: 0,
      }}
    />
  );
}

/**
 * Shared nav body: brand, nav list, collapse toggle and footer.
 *
 * @param collapsed - when true the rail collapses to icons only (desktop).
 * @param onToggle  - handler for the collapse/expand toggle button.
 * @param onClose   - when provided, renders a close button (mobile drawer).
 */
function NavBody({
  collapsed,
  onToggle,
  onClose,
}: {
  collapsed: boolean;
  onToggle: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      {onClose && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', py: 1 }}>
          <IconButton onClick={onClose} aria-label="Close navigation">
            <X size={20} />
          </IconButton>
        </Box>
      )}

      <Box sx={{ px: 3, py: 3.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}
        >
          <BrandMark />
          {!collapsed && (
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="h6"
                color="text.primary"
                sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}
              >
                {BRAND}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                VictoriaMetrics &amp; Home Dashboard
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
      <Divider sx={{ mx: collapsed ? 1 : undefined, borderColor: 'surface.divide' }} />

      <List sx={{ flex: 1, py: 1, px: collapsed ? 0.5 : undefined }}>
        {NAV_ITEMS.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton
              component={NavLink}
              to={item.to}
              sx={{
                borderRadius: 1,
                justifyContent: collapsed ? 'center' : 'flex-start',
                py: 0.75,
                mx: 0.5,
                '&[data-active]': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                },
                '&:hover': { bgcolor: 'surface.dark' },
              }}
            >
              <ListItemIcon
                sx={{
                  color: 'inherit',
                  minWidth: collapsed ? 0 : 56,
                  justifyContent: collapsed ? 'center' : undefined,
                }}
              >
                <item.icon size={20} />
              </ListItemIcon>
              {!collapsed && <ListItemText primary={item.label} />}
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ px: 1, pb: 1 }}>
        <Divider sx={{ mb: 1, borderColor: 'surface.divide' }} />
        <IconButton
          onClick={onToggle}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          sx={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            px: 1,
            py: 0.5,
            color: 'text.secondary',
            '&:hover': { bgcolor: 'surface.dark' },
          }}
        >
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </IconButton>
      </Box>

      {!collapsed && (
        <>
          <Divider sx={{ my: 1, borderColor: 'surface.divide' }} />
          <Box sx={{ px: 3, pb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Database size={16} />
            <Typography variant="caption" color="text.secondary">
              Grafana &times; VictoriaMetrics
            </Typography>
          </Box>
        </>
      )}
    </>
  );
}

/**
 * M3-inspired application layout:
 *   - Desktop (md+): a permanent, collapsible navigation rail (icon-only when
 *     collapsed), whose state is remembered in localStorage.
 *   - Mobile (xs): a temporary slide-in drawer opened from the top app bar's
 *     hamburger, with a working close mechanism (backdrop tap / close button).
 */
export default function AppLayout() {
  const theme = useTheme();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(!prev));
      } catch {
        /* ignore storage failures (private mode, etc.) */
      }
      return !prev;
    });
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Desktop navigation rail (md+). Plain Box on purpose: MUI's permanent
          Drawer paper is position:fixed, so a width would span the viewport and
          cover the content. A plain flex child always occupies real layout
          space and can never overlay the content column. */}
      <Box
        component="nav"
        aria-label="Primary"
        sx={{
          width: collapsed ? COLLAPSED_WIDTH : DRAWER_WIDTH,
          flexShrink: 0,
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          transition: 'width 220ms ease-in-out',
          backgroundColor: 'surface.dark',
          borderRight: '1px solid',
          borderColor: 'surface.divide',
        }}
      >
        <NavBody collapsed={collapsed} onToggle={toggleCollapsed} />
      </Box>

      {/* Main column: app bar (mobile) + content. */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top app bar — visible on mobile only; opens the temporary drawer. */}
        <AppBar
          position="fixed"
          sx={{
            display: { xs: 'block', md: 'none' },
            bgcolor: 'surface.dark',
            zIndex: theme.zIndex.appBar,
          }}
        >
          <Toolbar>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
              sx={{ mr: 2 }}
            >
              <Menu size={24} />
            </IconButton>
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              {BRAND}
            </Typography>
          </Toolbar>
        </AppBar>

        {/* Mobile temporary drawer (xs only). */}
        <Drawer
          variant="temporary"
          anchor="left"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              backgroundColor: 'surface.dark',
              borderRight: '1px solid',
              borderColor: 'surface.divide',
              display: 'flex',
              flexDirection: 'column',
            },
          }}
        >
          <NavBody
            collapsed={false}
            onToggle={toggleCollapsed}
            onClose={() => setMobileOpen(false)}
          />
        </Drawer>

        <Box
          component="main"
          sx={{
            flex: '1 0 auto',
            pt: { xs: theme.spacing(9), md: 0 },
            px: { xs: 2, md: 3 },
            py: 3,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
import { createTheme, type Theme, type Palette } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

declare module '@mui/material/styles' {
  interface Palette {
    /** Custom M3-style surface tokens used by cards across the app. */
    surface: {
      default: string;
      variant: string;
      dark: string;
      divide: string;
    };
  }
}

/**
 * Catppuccin Mocha — Dark color palette (see SPEC.md, "Design Rules").
 * Used to configure the Material Design 3 (M3) theme for VicDash.
 */
const CATPPUCCIN = {
  // Surfaces & backgrounds
  Base: '#1e1e2e',
  Mantle: '#181825',
  Crust: '#11111b',
  Surface0: '#313244',
  Surface1: '#45475a',
  Surface2: '#585b70',
  // Text
  TextPrimary: '#cdd6f4',
  TextSecondary: '#a6adc8',
  TextDisabled: '#6c7086',
  // Accents
  Mauve: '#cba6f7',
  Blue: '#89b4fa',
  Teal: '#89dceb',
  Green: '#a6e3a1',
  Peach: '#fab387',
  Red: '#f38ba8',
} as const;

/**
 * Builds the VicDash MUI v6 theme configured with the Catppuccin Mocha palette.
 *
 * Default `MuiPaper` surfaces get:
 *  - 16px corner radius (`borderRadius: 2`)
 *  - a `1px solid #313244` (Surface0) border
 */
export function buildVicDashTheme(mode: PaletteMode = 'dark'): Theme {
  const theme = createTheme({
    palette: {
      mode,
      primary: { main: CATPPUCCIN.Mauve },
      secondary: { main: CATPPUCCIN.Blue },
      info: { main: CATPPUCCIN.Teal },
      success: { main: CATPPUCCIN.Green },
      warning: { main: CATPPUCCIN.Peach },
      error: { main: CATPPUCCIN.Red },
      text: {
        primary: CATPPUCCIN.TextPrimary,
        secondary: CATPPUCCIN.TextSecondary,
        disabled: CATPPUCCIN.TextDisabled,
      },
      background: {
        default: CATPPUCCIN.Base,
        paper: CATPPUCCIN.Mantle,
      },
    },
    shape: {
      borderRadius: 2,
    },
    typography: {
      fontFamily:
        "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      h1: { fontWeight: 700, fontSize: '2.5rem' },
      h2: { fontWeight: 600, fontSize: '2rem' },
      h3: { fontWeight: 600, fontSize: '1.75rem' },
      h4: { fontWeight: 600, fontSize: '1.5rem' },
      h5: { fontWeight: 500, fontSize: '1.25rem' },
      h6: { fontWeight: 500, fontSize: '1rem' },
    },
    components: {
      MuiPaper: {
        defaultProps: {
          elevation: 1,
        },
        styleOverrides: {
          root: {
            borderRadius: 2,
            border: `1px solid ${CATPPUCCIN.Surface0}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 2,
            border: `1px solid ${CATPPUCCIN.Surface0}`,
          },
        },
      },
      MuiCardMedia: {
        styleOverrides: {
          root: {
            borderRadius: 2,
          },
        },
      },
      MuiButton: {
        defaultProps: {
          variant: 'contained',
        },
        styleOverrides: {
          root: {
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 600,
            color: CATPPUCCIN.TextSecondary,
            backgroundColor: CATPPUCCIN.Mantle,
          },
        },
      },
    },
  });

  // Attach custom M3-style surface tokens (not part of `PaletteOptions`).
  (theme.palette as Palette).surface = {
    default: CATPPUCCIN.Mantle,
    variant: CATPPUCCIN.Base,
    dark: CATPPUCCIN.Crust,
    divide: CATPPUCCIN.Surface0,
  };

  return theme;
}

/** Ready-to-use default (dark) theme instance. */
export const vicDashTheme: Theme = buildVicDashTheme('dark');

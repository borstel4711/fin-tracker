import type { ApexOptions } from 'apexcharts';

export type Theme = 'dark' | 'light';

export interface ChartColors {
  accent: string;
  accent2: string;
  green: string;
  red: string;
  cyan: string;
  orange: string;
  muted: string;
  border: string;
  violet: string;
  pink: string;
}

// Einzige Quelle der Wahrheit für Chart-Farben. Die Werte spiegeln die
// Theme-Tokens aus index.css (--accent, --accent2, --green, --red, --cyan,
// --orange, --text-muted, --border); wird dort ein Token geändert, hier
// nachziehen. So dupliziert nicht mehr jede Chart-Seite ihre eigenen Hex-Werte,
// und Charts bleiben farblich konsistent zur restlichen UI in beiden Themes.
//
// violet/pink haben (noch) kein UI-Token und sind reine Kategorie-Farben.
const PALETTES: Record<Theme, ChartColors> = {
  dark: {
    accent: '#f59e0b',
    accent2: '#3b82f6',
    green: '#22c55e',
    red: '#ef4444',
    cyan: '#06b6d4',
    orange: '#f97316',
    muted: '#94a3b8',
    border: '#2e3147',
    violet: '#7c3aed',
    pink: '#db2777',
  },
  light: {
    accent: '#d97706',
    accent2: '#2563eb',
    green: '#16a34a',
    red: '#dc2626',
    cyan: '#0891b2',
    orange: '#ea580c',
    muted: '#6b7280',
    border: '#d1d5db',
    violet: '#7c3aed',
    pink: '#db2777',
  },
};

export function chartColors(theme: Theme): ChartColors {
  return PALETTES[theme];
}

// Kategorische Palette als Fallback für Serien ohne eigene Farbe.
export function chartPalette(theme: Theme): string[] {
  const c = PALETTES[theme];
  return [c.accent2, c.green, c.red, c.accent, c.violet, c.cyan, c.pink];
}

// Gemeinsame, theme-abhängige Basis-Optionen für alle ApexCharts.
export function chartTheme(theme: Theme) {
  const c = PALETTES[theme];
  const baseOptions: ApexOptions = {
    chart: { foreColor: c.muted, toolbar: { show: false }, background: 'transparent' },
    grid: { borderColor: c.border },
    tooltip: { theme },
  };
  return { colors: c, baseOptions };
}

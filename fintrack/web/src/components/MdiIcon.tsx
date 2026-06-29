import { useTheme } from '../ThemeContext';
import { chartColors } from '../utils/chartTheme';

// Semantische Icon-Farben aus derselben Theme-Token-Quelle wie die Charts
// (chartTheme.ts), damit Icons nicht erneut eigene Hex-Werte duplizieren.
type IconVariant = 'accent' | 'danger' | 'muted';

interface MdiIconProps {
  name: string | null | undefined;
  color?: string | null;
  variant?: IconVariant;
  size?: number;
  className?: string;
}

export default function MdiIcon({ name, color, variant, size = 18, className }: MdiIconProps) {
  const { theme } = useTheme();
  if (!name) return null;
  const iconName = name.trim().replace(/^mdi:/, '');
  if (!iconName) return null;
  const c = chartColors(theme);
  const variantColors = { accent: c.accent2, danger: c.red, muted: c.muted };
  const resolvedColor = color ?? (variant ? variantColors[variant] : null);
  const params = resolvedColor ? `?color=${encodeURIComponent(resolvedColor)}` : '';
  const src = `https://api.iconify.design/mdi:${iconName}.svg${params}`;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

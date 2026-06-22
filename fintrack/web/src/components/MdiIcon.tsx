interface MdiIconProps {
  name: string | null | undefined;
  color?: string | null;
  size?: number;
  className?: string;
}

export default function MdiIcon({ name, color, size = 18, className }: MdiIconProps) {
  if (!name) return null;
  const iconName = name.trim().replace(/^mdi:/, '');
  if (!iconName) return null;
  const params = color ? `?color=${encodeURIComponent(color)}` : '';
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

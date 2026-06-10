import { Icon as Iconify } from '@iconify/react';

// Thin wrapper over @iconify/react so screens can use short Solar icon names.
export default function Icon({ icon, size = 20, color, style }) {
  return <Iconify icon={icon} width={size} height={size} style={{ color, display: 'inline-flex', ...style }} />;
}

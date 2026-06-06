import { PATHS, type IconName } from '@/utils/icons';

export type { IconName };

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  'aria-label'?: string;
}

export function Icon({ name, size = 16, strokeWidth = 2, className, 'aria-label': label }: IconProps) {
  const path = PATHS[name];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: path }}
    />
  );
}

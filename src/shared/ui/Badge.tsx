import { cva, type VariantProps } from 'class-variance-authority';

const badge = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-surface-2 text-fg-2',
        accent:  'bg-accent-light text-ok',
        warn:    'bg-warn-bg text-warn',
        danger:  'bg-red-light text-red',
        muted:   'bg-surface-3 text-muted',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={badge({ variant, className })} {...props} />;
}

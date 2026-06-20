import { cva, type VariantProps } from 'class-variance-authority';

const skeleton = cva('animate-pulse rounded bg-surface-2', {
  variants: {
    variant: {
      text:   'h-4 w-full',
      title:  'h-6 w-2/3',
      card:   'h-24 w-full',
      circle: 'rounded-full',
    },
  },
  defaultVariants: { variant: 'text' },
});

interface SkeletonProps extends VariantProps<typeof skeleton> {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ variant, className, style }: SkeletonProps) {
  return <div className={skeleton({ variant, className })} style={style} aria-hidden="true" />;
}

import { forwardRef } from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

const button = cva(
  'inline-flex items-center justify-center gap-1.5 font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default:  'bg-surface-2 text-fg hover:bg-border',
        primary:  'bg-accent text-accent-fg hover:bg-accent-dark',
        danger:   'bg-red text-white hover:opacity-90',
        link:     'text-accent underline-offset-4 hover:underline p-0 h-auto',
        icon:     'text-fg-2 hover:text-fg hover:bg-border rounded-sm p-0',
        ghost:    'text-fg-2 hover:text-fg hover:bg-border',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-sm',
        lg: 'h-10 px-4 text-sm',
      },
    },
    defaultVariants: { variant: 'default', size: 'md' },
  },
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp ref={ref} className={button({ variant, size, className })} {...props} />;
  },
);
Button.displayName = 'Button';

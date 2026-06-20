import { forwardRef } from 'react';

const base = [
  'h-8 w-full rounded border border-border bg-surface-1 px-2.5 text-base md:text-sm text-fg',
  'placeholder:text-muted',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  'disabled:opacity-50 disabled:cursor-not-allowed',
  // Hide number input spinners (WebKit + Firefox)
  '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
].join(' ');

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...props }, ref) => (
    <input ref={ref} className={`${base} ${className}`} {...props} />
  ),
);
Input.displayName = 'Input';

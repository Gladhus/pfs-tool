import { forwardRef } from 'react';

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = '', ...props }, ref) => (
    <label
      ref={ref}
      className={`block text-xs font-medium text-fg-2 mb-1 ${className}`}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

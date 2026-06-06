import * as RadixCheckbox from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';

interface CheckboxProps {
  id?: string;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  className?: string;
}

export function Checkbox({ id, checked, onCheckedChange, disabled, label, className = '' }: CheckboxProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <RadixCheckbox.Root
        id={id}
        checked={checked}
        onCheckedChange={v => onCheckedChange?.(v === true)}
        disabled={disabled}
        className={[
          'h-4 w-4 shrink-0 rounded border border-border bg-surface-1',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
          'transition-colors',
        ].join(' ')}
      >
        <RadixCheckbox.Indicator className="flex items-center justify-center text-white">
          <Check size={11} strokeWidth={3} />
        </RadixCheckbox.Indicator>
      </RadixCheckbox.Root>
      {label && (
        <label
          htmlFor={id}
          className="text-sm text-fg cursor-pointer select-none"
        >
          {label}
        </label>
      )}
    </div>
  );
}

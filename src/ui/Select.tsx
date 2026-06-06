import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';

const triggerCls =
  'h-8 w-full rounded border border-border bg-surface-1 px-2.5 text-sm text-fg ' +
  'inline-flex items-center justify-between gap-1 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'data-[placeholder]:text-muted';

const contentCls =
  'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg ' +
  'border border-border bg-surface-3 shadow-lg ' +
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 ' +
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95';

const itemCls =
  'relative flex cursor-pointer select-none items-center px-3 py-1.5 text-sm text-fg ' +
  'rounded data-[highlighted]:bg-border data-[highlighted]:outline-none ' +
  'data-[disabled]:opacity-40 data-[disabled]:pointer-events-none';

const labelCls = 'px-3 py-1 text-xs font-semibold text-muted';

interface SelectProps {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  disabled?: boolean;
  placeholder?: string;
  children: React.ReactNode;
}

export function Select({ value, onValueChange, defaultValue, disabled, placeholder, children }: SelectProps) {
  return (
    <RadixSelect.Root value={value} onValueChange={onValueChange} defaultValue={defaultValue}>
      <RadixSelect.Trigger className={triggerCls} disabled={disabled}>
        <RadixSelect.Value placeholder={placeholder ?? '—'} />
        <RadixSelect.Icon asChild>
          <ChevronDown size={14} className="text-muted shrink-0" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content className={contentCls} position="popper" sideOffset={4}>
          <RadixSelect.Viewport className="p-1">
            {children}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export function SelectItem({ value, children, disabled }: { value: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <RadixSelect.Item value={value} disabled={disabled} className={itemCls}>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
      <RadixSelect.ItemIndicator className="absolute right-2">
        <Check size={12} className="text-accent" />
      </RadixSelect.ItemIndicator>
    </RadixSelect.Item>
  );
}

export function SelectGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <RadixSelect.Group>
      <RadixSelect.Label className={labelCls}>{label}</RadixSelect.Label>
      {children}
    </RadixSelect.Group>
  );
}

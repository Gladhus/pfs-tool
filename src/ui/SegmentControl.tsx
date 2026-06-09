import * as ToggleGroup from '@radix-ui/react-toggle-group';

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  block?: boolean;
  /** Full-width flex on mobile, natural inline-flex on md+ */
  responsive?: boolean;
  'aria-label'?: string;
}

const baseTrackCls = 'rounded bg-surface-2 p-0.5 gap-0.5';

const itemBase = [
  'rounded transition-colors whitespace-nowrap',
  'text-muted hover:text-fg',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  'data-[state=on]:bg-surface-1 data-[state=on]:text-fg data-[state=on]:font-medium data-[state=on]:shadow-xs',
].join(' ');

const itemSize = 'px-3 py-1 text-sm';
const itemSizeResponsive = 'px-1 py-0.5 text-xs md:px-3 md:py-1 md:text-sm';

export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  className = '',
  block = false,
  responsive = false,
  'aria-label': label,
}: SegmentControlProps<T>) {
  const trackFlex = block || responsive
    ? 'flex w-full'
    : 'inline-flex';

  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={v => { if (v) onChange(v as T); }}
      aria-label={label}
      className={`${baseTrackCls} ${trackFlex} ${className}`}
    >
      {options.map(opt => (
        <ToggleGroup.Item
          key={opt.value}
          value={opt.value}
          className={`${itemBase} ${responsive ? itemSizeResponsive : itemSize} ${block || responsive ? 'flex-1 text-center' : ''}`}
        >
          {opt.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

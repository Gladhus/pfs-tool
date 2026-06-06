import { useRef } from 'react';
import { cva } from 'class-variance-authority';

const track = cva('inline-flex rounded bg-surface-2 p-0.5 gap-0.5');

const seg = cva(
  'px-3 py-1 text-sm rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
  {
    variants: {
      active: {
        true:  'bg-surface-1 text-fg font-medium shadow-xs',
        false: 'text-muted hover:text-fg',
      },
    },
    defaultVariants: { active: false },
  },
);

interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}

export function SegmentControl<T extends string>({
  options,
  value,
  onChange,
  className,
  'aria-label': label,
}: SegmentControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      const next = (index + 1) % options.length;
      refs.current[next]?.focus();
      onChange(options[next].value);
    } else if (e.key === 'ArrowLeft') {
      const prev = (index - 1 + options.length) % options.length;
      refs.current[prev]?.focus();
      onChange(options[prev].value);
    }
  };

  return (
    <div role="group" aria-label={label} className={track({ className })}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          ref={(el) => { refs.current[i] = el; }}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          className={seg({ active: opt.value === value })}
          onClick={() => onChange(opt.value)}
          onKeyDown={(e) => handleKeyDown(e, i)}
          tabIndex={opt.value === value ? 0 : -1}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

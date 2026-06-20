import { Icon } from '@/ui/Icon';

interface Props {
  /** Stored value, YYYY-MM-DD. */
  value: string;
  onChange: (date: string) => void;
}

function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function DateField({ value, onChange }: Props) {
  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous day"
        className="flex h-8 w-8 items-center justify-center rounded text-fg-2 hover:bg-border hover:text-fg"
        onClick={() => onChange(shiftDays(value, -1))}
      >
        <Icon name="chevronDown" size={16} className="rotate-90" />
      </button>
      <input
        type="date"
        value={value}
        onChange={e => { if (e.target.value) onChange(e.target.value); }}
        className="h-8 rounded border border-border bg-surface-1 px-2 text-base md:text-sm text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      <button
        type="button"
        aria-label="Next day"
        className="flex h-8 w-8 items-center justify-center rounded text-fg-2 hover:bg-border hover:text-fg"
        onClick={() => onChange(shiftDays(value, 1))}
      >
        <Icon name="chevronDown" size={16} className="-rotate-90" />
      </button>
    </div>
  );
}

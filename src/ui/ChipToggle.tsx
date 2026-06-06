interface ChipToggleProps {
  label: string;
  color: string;
  active: boolean;
  onToggle: () => void;
}

export function ChipToggle({ label, color, active, onToggle }: ChipToggleProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={active}
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-surface-2 text-fg' : 'text-muted hover:text-fg'
      }`}
      style={{ borderColor: active ? color : 'var(--color-border)' }}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={active ? { backgroundColor: color } : { boxShadow: `inset 0 0 0 2px ${color}` }}
      />
      {label}
    </button>
  );
}

import { TAG_PALETTE } from '@/shared/utils/colors';

interface Props {
  value: string;
  onChange: (color: string) => void;
  colors?: string[];
}

export function ColorSwatchPicker({ value, onChange, colors = TAG_PALETTE }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map(c => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={c}
          aria-pressed={c === value}
          onClick={() => onChange(c)}
          style={{ backgroundColor: c }}
          className={`h-7 w-7 rounded-full transition-transform ${c === value ? 'ring-2 ring-fg ring-offset-2 ring-offset-surface-1' : 'hover:scale-110'}`}
        />
      ))}
    </div>
  );
}

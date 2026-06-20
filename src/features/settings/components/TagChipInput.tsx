import { useId, useState } from 'react';
import { Icon } from '@/shared/ui/Icon';
import { tagColor } from '@/shared/utils/colors';

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  available?: string[];
  placeholder?: string;
}

export function TagChipInput({ value, onChange, available = [], placeholder }: Props) {
  const [text, setText] = useState('');
  const listId = useId();

  const add = (raw: string) => {
    const tag = raw.trim();
    if (!tag || value.includes(tag)) { setText(''); return; }
    onChange([...value, tag]);
    setText('');
  };

  const remove = (tag: string) => onChange(value.filter(t => t !== tag));

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(text);
    } else if (e.key === 'Backspace' && !text && value.length) {
      remove(value[value.length - 1]);
    }
  };

  const suggestions = available.filter(t => !value.includes(t));

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded border border-border bg-surface-1 p-1.5 focus-within:ring-2 focus-within:ring-accent">
      {value.map(tag => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-white"
          style={{ backgroundColor: tagColor(tag) }}
        >
          {tag}
          <button type="button" aria-label={`Remove ${tag}`} onClick={() => remove(tag)} className="hover:opacity-80">
            <Icon name="x" size={11} />
          </button>
        </span>
      ))}
      <input
        type="text"
        list={listId}
        value={text}
        placeholder={placeholder}
        onChange={e => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(text)}
        className="min-w-[6rem] flex-1 bg-transparent px-1 text-base md:text-sm text-fg outline-none"
      />
      <datalist id={listId}>
        {suggestions.map(t => <option key={t} value={t} />)}
      </datalist>
    </div>
  );
}

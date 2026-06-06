import { useState, useRef, useEffect, useCallback } from 'react';
import type { Account, CategoryMeta } from '@/types/sheets';
import { Icon } from '@/ui/Icon';
import { tr } from '@/i18n';
import { activeAccounts } from '@/utils/balance';
import { useTranslation } from 'react-i18next';

interface Props {
  accounts: Account[];
  categoryMeta: CategoryMeta[];
  value: string;
  onChange: (value: string) => void;
}

type FlatItem =
  | { isGroup: true; label: string }
  | { isGroup: false; value: string; label: string };

export function AccountSelect({ accounts, categoryMeta, value, onChange }: Props) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const items: FlatItem[] = [{ isGroup: false, value: '', label: t('overview_option') }];
  const catOrder = Object.fromEntries(categoryMeta.map(c => [c.id, c.sort_order ?? 0]));
  const active = [...activeAccounts(accounts)].sort((a, b) => {
    const co = (catOrder[a.category] ?? 99) - (catOrder[b.category] ?? 99);
    return co !== 0 ? co : (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  const byCat: Record<string, Account[]> = {};
  for (const a of active) (byCat[a.category] ??= []).push(a);
  for (const cat of [...categoryMeta].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))) {
    if (!byCat[cat.id]?.length) continue;
    items.push({ isGroup: true, label: tr(cat) });
    for (const a of byCat[cat.id]) items.push({ isGroup: false, value: a.id, label: tr(a) });
  }

  const options = items.filter((i): i is Extract<FlatItem, { isGroup: false }> => !i.isGroup);
  const selectedLabel = options.find(o => o.value === value)?.label ?? t('overview_option');

  const open = useCallback(() => {
    setIsOpen(true);
    requestAnimationFrame(() => {
      const selIdx = options.findIndex(o => o.value === value);
      optionRefs.current[Math.max(0, selIdx)]?.focus();
    });
  }, [options, value]);

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  const select = useCallback((v: string) => {
    onChange(v);
    close();
  }, [onChange, close]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  let optIdx = 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 text-sm text-foreground hover:bg-surface-3 transition-colors min-w-[140px] justify-between"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : open())}
        onKeyDown={e => {
          if ((e.key === 'ArrowDown' || e.key === 'Enter') && !isOpen) { e.preventDefault(); open(); }
          if (e.key === 'Escape' && isOpen) { e.preventDefault(); close(); }
        }}
      >
        <span className="truncate">{selectedLabel}</span>
        <Icon name="chevronDown" size={14} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={t('account_label')}
          className="absolute left-0 top-full mt-1 z-50 min-w-full w-max max-h-72 overflow-y-auto rounded-xl bg-surface-2 border border-border shadow-lg py-1"
        >
          {items.map((item, i) => {
            if (item.isGroup) {
              return (
                <div key={`g-${i}`} role="presentation" className="px-3 py-1 text-xs font-medium text-muted uppercase tracking-wide">
                  {item.label}
                </div>
              );
            }
            const myIdx = optIdx++;
            const isSel = item.value === value;
            return (
              <button
                key={item.value}
                ref={el => { optionRefs.current[myIdx] = el; }}
                type="button"
                role="option"
                aria-selected={isSel}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 hover:bg-surface-3 transition-colors ${isSel ? 'text-accent font-medium' : 'text-foreground'}`}
                onClick={() => select(item.value)}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); optionRefs.current[Math.min(myIdx + 1, options.length - 1)]?.focus(); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); if (myIdx <= 0) close(); else optionRefs.current[myIdx - 1]?.focus(); }
                  if (e.key === 'Escape') { e.preventDefault(); close(); }
                  if (e.key === 'Enter') { e.preventDefault(); select(item.value); }
                }}
              >
                <span className="truncate">{item.label}</span>
                {isSel && <Icon name="check" size={12} className="shrink-0 text-accent" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

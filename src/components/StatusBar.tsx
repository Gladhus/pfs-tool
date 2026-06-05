import { useStatusStore } from '@/stores/status.store';

export default function StatusBar() {
  const { message, level } = useStatusStore();
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'px-4 py-2 text-sm text-center transition-all',
        level === 'warn' ? 'bg-amber-900/60 text-amber-200' : 'bg-slate-800 text-slate-300',
      ].join(' ')}
    >
      {message}
    </div>
  );
}

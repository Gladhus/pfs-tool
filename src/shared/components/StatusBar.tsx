import { useStatusStore } from '@/shared/stores/status.store';

export default function StatusBar() {
  const { message, level } = useStatusStore();
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'px-4 py-2 text-sm text-center transition-all',
        level === 'warn' ? 'bg-warn-bg text-warn' : 'bg-surface-2 text-fg-2',
      ].join(' ')}
    >
      {message}
    </div>
  );
}

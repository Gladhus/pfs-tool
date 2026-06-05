// Pure function: maps a key + context to an action name, or null if unhandled.
// Callers execute the action; this layer is independently testable.
export function dispatchShortcut(key, { stockOptEnabled, saveEnabled, onEntryTab }) {
  if (key === '1') return 'tab:overview';
  if (key === '2') return 'tab:accounts/detail';
  if (key === '3') return 'tab:accounts/history';
  if (key === 'm') return 'tab:accounts/manage';
  if (key === '4' && stockOptEnabled) return 'tab:options';
  if (key === 'n') return 'tab:entry';
  if (key === 's' && saveEnabled && onEntryTab) return 'save';
  if (key === 'p') return 'private';
  if (key === ',') return 'tab:settings';
  if (key === '?') return 'help';
  return null;
}

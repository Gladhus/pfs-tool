export interface ShortcutContext {
  stockOptEnabled: boolean;
  saveEnabled: boolean;
  onEntryTab: boolean;
}

export type ShortcutAction =
  | 'tab:overview'
  | 'tab:accounts/detail'
  | 'tab:accounts/history'
  | 'tab:accounts/manage'
  | 'tab:options'
  | 'tab:entry'
  | 'tab:settings'
  | 'save'
  | 'private'
  | 'help';

export function dispatchShortcut(
  key: string,
  ctx: ShortcutContext,
): ShortcutAction | null {
  if (key === '1') return 'tab:overview';
  if (key === '2') return 'tab:accounts/detail';
  if (key === '3') return 'tab:accounts/history';
  if (key === 'm') return 'tab:accounts/manage';
  if (key === '4' && ctx.stockOptEnabled) return 'tab:options';
  if (key === 'n') return 'tab:entry';
  if (key === 's' && ctx.saveEnabled && ctx.onEntryTab) return 'save';
  if (key === 'p') return 'private';
  if (key === ',') return 'tab:settings';
  if (key === '?') return 'help';
  return null;
}

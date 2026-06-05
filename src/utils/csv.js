export function snapshotsToCsv(snapshots, headers) {
  const rows = [
    headers,
    ...snapshots.map(s => [s.date, s.account_id, s.balance_raw, s.comment || '', s.entered_at || '']),
  ];
  return rows.map(r => r.map(cell => {
    const s = String(cell ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\n');
}

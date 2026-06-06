import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { qk } from './keys';
import type { Account, Snapshot, Tag, Group, AppConfig, OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';
import { safeWriteTab } from '@/api/sheets';
import { HEADERS } from '@/constants';
import { writeTagsCatalog } from '@/api/tags';
import { writeGroupsCatalog } from '@/api/groups';
import { writeConfig } from '@/api/config';
import { writeOptionCompanies, writeOptionGrants, writeOptionFmv, writeOptionExercises } from '@/api/options';

function useSheetId() {
  return useAuthStore(s => s.sheetId)!;
}

function prevCount<T>(data: T[] | undefined): number {
  return data?.length ?? 0;
}

// ── Snapshot save (optimistic upsert) ──────────────────────────────────
export function useSaveSnapshotMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();

  return useMutation({
    mutationFn: async (snapshot: Snapshot) => {
      const cached = qc.getQueryData<Snapshot[]>(qk.snapshots(sheetId)) ?? [];
      const key = `${snapshot.date}|${snapshot.account_id}`;
      const rows = cached.map(s => `${s.date}|${s.account_id}` === key ? snapshot : s);
      if (!rows.some(s => `${s.date}|${s.account_id}` === key)) rows.push(snapshot);
      const allRows: unknown[][] = [
        HEADERS.snapshots as unknown as string[],
        ...rows.map(s => [s.date, s.account_id, s.balance_raw, s.comment ?? '', s.entered_at ?? '']),
      ];
      await safeWriteTab(sheetId, 'snapshots', allRows, cached.length);
      return rows;
    },
    onMutate: async (snapshot: Snapshot) => {
      await qc.cancelQueries({ queryKey: qk.snapshots(sheetId) });
      const prev = qc.getQueryData<Snapshot[]>(qk.snapshots(sheetId));
      qc.setQueryData<Snapshot[]>(qk.snapshots(sheetId), old => {
        if (!old) return [snapshot];
        const key = `${snapshot.date}|${snapshot.account_id}`;
        const updated = old.map(s => `${s.date}|${s.account_id}` === key ? snapshot : s);
        if (!updated.some(s => `${s.date}|${s.account_id}` === key)) updated.push(snapshot);
        return updated;
      });
      return { prev };
    },
    onError: (_err, _snap, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.snapshots(sheetId), ctx.prev);
    },
    onSuccess: (rows) => {
      qc.setQueryData(qk.snapshots(sheetId), rows);
    },
  });
}

// ── Month save (replace all rows for one date) ──────────────────────────
// Mirrors vanilla saveSnapshot: every active account is represented in the
// Entry form, so saving rewrites the full set of rows for `date` — entered
// rows are kept, cleared rows are dropped (deleted), and the day comment row
// is upserted. Rows for other dates are untouched.
export interface SaveMonthInput {
  date: string;
  rows: Snapshot[]; // complete desired set of rows for `date` (incl. __day__ if any)
}

export function useSaveMonthMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();

  const replaceForDate = (cached: Snapshot[], { date, rows }: SaveMonthInput): Snapshot[] => {
    const kept = cached.filter(s => s.date !== date);
    return [...kept, ...rows];
  };

  return useMutation({
    mutationFn: async (input: SaveMonthInput) => {
      const cached = qc.getQueryData<Snapshot[]>(qk.snapshots(sheetId)) ?? [];
      const next = replaceForDate(cached, input);
      const allRows: unknown[][] = [
        HEADERS.snapshots as unknown as string[],
        ...next.map(s => [s.date, s.account_id, s.balance_raw, s.comment ?? '', s.entered_at ?? '']),
      ];
      await safeWriteTab(sheetId, 'snapshots', allRows, cached.length);
      return next;
    },
    onMutate: async (input: SaveMonthInput) => {
      await qc.cancelQueries({ queryKey: qk.snapshots(sheetId) });
      const prev = qc.getQueryData<Snapshot[]>(qk.snapshots(sheetId));
      qc.setQueryData<Snapshot[]>(qk.snapshots(sheetId), old => replaceForDate(old ?? [], input));
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.snapshots(sheetId), ctx.prev);
    },
    onSuccess: (next) => {
      qc.setQueryData(qk.snapshots(sheetId), next);
    },
  });
}

// ── Accounts ────────────────────────────────────────────────────────────
export function useWriteAccountsMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();
  return useMutation({
    mutationFn: async (accounts: Account[]) => {
      const prev = prevCount(qc.getQueryData<Account[]>(qk.accounts(sheetId)));
      const rows: unknown[][] = [
        HEADERS.accounts as unknown as string[],
        ...accounts.map(a => HEADERS.accounts.map(h => {
          const v = (a as unknown as Record<string, unknown>)[h];
          if (h === 'active') return a.active ? 'TRUE' : 'FALSE';
          if (h === 'tags') return Array.isArray(a.tags) ? a.tags.join(', ') : '';
          return v ?? '';
        })),
      ];
      await safeWriteTab(sheetId, 'accounts', rows, prev);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.accounts(sheetId) });
      void qc.invalidateQueries({ queryKey: qk.snapshots(sheetId) });
    },
  });
}

export function useDeleteAccountMutation() {
  return useWriteAccountsMutation();
}

// ── Tags ────────────────────────────────────────────────────────────────
export function useWriteTagsMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();
  return useMutation({
    mutationFn: (tags: Tag[]) => {
      const prev = prevCount(qc.getQueryData<Tag[]>(qk.tags(sheetId)));
      return writeTagsCatalog(sheetId, tags, prev);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.tags(sheetId) }),
  });
}

export function useMergeTagsMutation() {
  return useWriteTagsMutation();
}

// ── Groups ──────────────────────────────────────────────────────────────
export function useWriteGroupsMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();
  return useMutation({
    mutationFn: (groups: Group[]) => {
      const prev = prevCount(qc.getQueryData<Group[]>(qk.groups(sheetId)));
      return writeGroupsCatalog(sheetId, groups, prev);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.groups(sheetId) }),
  });
}

// ── Config ──────────────────────────────────────────────────────────────
export function useWriteConfigMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();
  return useMutation({
    mutationFn: ({ key, value }: { key: keyof AppConfig; value: string }) =>
      writeConfig(sheetId, key, value),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.config(sheetId) }),
  });
}

// ── Options ─────────────────────────────────────────────────────────────
export function useWriteOptionCompaniesMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();
  return useMutation({
    mutationFn: (items: OptionCompany[]) =>
      writeOptionCompanies(sheetId, items, prevCount(qc.getQueryData<OptionCompany[]>(qk.optCompanies(sheetId)))),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.optCompanies(sheetId) }),
  });
}

export function useWriteOptionGrantsMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();
  return useMutation({
    mutationFn: (items: OptionGrant[]) =>
      writeOptionGrants(sheetId, items, prevCount(qc.getQueryData<OptionGrant[]>(qk.optGrants(sheetId)))),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.optGrants(sheetId) }),
  });
}

export function useWriteOptionFmvMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();
  return useMutation({
    mutationFn: (items: OptionFmv[]) =>
      writeOptionFmv(sheetId, items, prevCount(qc.getQueryData<OptionFmv[]>(qk.optFmv(sheetId)))),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.optFmv(sheetId) }),
  });
}

export function useWriteOptionExercisesMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();
  return useMutation({
    mutationFn: (items: OptionExercise[]) =>
      writeOptionExercises(sheetId, items, prevCount(qc.getQueryData<OptionExercise[]>(qk.optExercises(sheetId)))),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.optExercises(sheetId) }),
  });
}

// ── Import (full snapshot overwrite) ────────────────────────────────────
export function useImportMutation() {
  const qc = useQueryClient();
  const sheetId = useSheetId();
  return useMutation({
    mutationFn: async (snapshots: Snapshot[]) => {
      const prev = prevCount(qc.getQueryData<Snapshot[]>(qk.snapshots(sheetId)));
      const rows: unknown[][] = [
        HEADERS.snapshots as unknown as string[],
        ...snapshots.map(s => [s.date, s.account_id, s.balance_raw, s.comment ?? '', s.entered_at ?? '']),
      ];
      await safeWriteTab(sheetId, 'snapshots', rows, prev);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.snapshots(sheetId) }),
  });
}

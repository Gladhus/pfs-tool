import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatasourceStore } from '@/stores/datasource.store';
import { qk } from './keys';
import type { Account, Snapshot, Tag, Group, Person, AppConfig, OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';

function useDatasource() {
  return useDatasourceStore(s => s.datasource)!;
}

// ── Snapshot save (optimistic upsert) ──────────────────────────────────
export function useSaveSnapshotMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();

  return useMutation({
    mutationFn: async (snapshot: Snapshot) => {
      const cached = qc.getQueryData<Snapshot[]>(qk.snapshots(ds.id)) ?? [];
      const key = `${snapshot.date}|${snapshot.account_id}`;
      const rows = cached.map(s => `${s.date}|${s.account_id}` === key ? snapshot : s);
      if (!rows.some(s => `${s.date}|${s.account_id}` === key)) rows.push(snapshot);
      await ds.writeSnapshots(rows);
      return rows;
    },
    onMutate: async (snapshot: Snapshot) => {
      await qc.cancelQueries({ queryKey: qk.snapshots(ds.id) });
      const prev = qc.getQueryData<Snapshot[]>(qk.snapshots(ds.id));
      qc.setQueryData<Snapshot[]>(qk.snapshots(ds.id), old => {
        if (!old) return [snapshot];
        const key = `${snapshot.date}|${snapshot.account_id}`;
        const updated = old.map(s => `${s.date}|${s.account_id}` === key ? snapshot : s);
        if (!updated.some(s => `${s.date}|${s.account_id}` === key)) updated.push(snapshot);
        return updated;
      });
      return { prev };
    },
    onError: (_err, _snap, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.snapshots(ds.id), ctx.prev);
    },
    onSuccess: (rows) => {
      qc.setQueryData(qk.snapshots(ds.id), rows);
    },
  });
}

// ── Month save (replace all rows for one date) ──────────────────────────
export interface SaveMonthInput {
  date: string;
  rows: Snapshot[];
}

export function useSaveMonthMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();

  const replaceForDate = (cached: Snapshot[], { date, rows }: SaveMonthInput): Snapshot[] => {
    const kept = cached.filter(s => s.date !== date);
    return [...kept, ...rows];
  };

  return useMutation({
    mutationFn: async (input: SaveMonthInput) => {
      const cached = qc.getQueryData<Snapshot[]>(qk.snapshots(ds.id)) ?? [];
      const next = replaceForDate(cached, input);
      await ds.writeSnapshots(next);
      return next;
    },
    onMutate: async (input: SaveMonthInput) => {
      await qc.cancelQueries({ queryKey: qk.snapshots(ds.id) });
      const prev = qc.getQueryData<Snapshot[]>(qk.snapshots(ds.id));
      qc.setQueryData<Snapshot[]>(qk.snapshots(ds.id), old => replaceForDate(old ?? [], input));
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.snapshots(ds.id), ctx.prev);
    },
    onSuccess: (next) => {
      qc.setQueryData(qk.snapshots(ds.id), next);
    },
  });
}

// ── Accounts ────────────────────────────────────────────────────────────
export function useWriteAccountsMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: (accounts: Account[]) => ds.writeAccounts(accounts),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.accounts(ds.id) });
      void qc.invalidateQueries({ queryKey: qk.snapshots(ds.id) });
    },
  });
}

export function useDeleteAccountMutation() {
  return useWriteAccountsMutation();
}

// ── Tags ────────────────────────────────────────────────────────────────
export function useWriteTagsMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: (tags: Tag[]) => ds.writeTags(tags),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.tags(ds.id) }),
  });
}

export function useMergeTagsMutation() {
  return useWriteTagsMutation();
}

// ── Groups ──────────────────────────────────────────────────────────────
export function useWriteGroupsMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: (groups: Group[]) => ds.writeGroups(groups),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.groups(ds.id) }),
  });
}

// ── People ──────────────────────────────────────────────────────────────
export function useWritePeopleMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: (people: Person[]) => ds.writePeople(people),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.people(ds.id) }),
  });
}

// ── Config ──────────────────────────────────────────────────────────────
export function useWriteConfigMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: ({ key, value }: { key: keyof AppConfig; value: string }) =>
      ds.writeConfig(key, value),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.config(ds.id) }),
  });
}

// ── Options ─────────────────────────────────────────────────────────────
export function useWriteOptionCompaniesMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: (items: OptionCompany[]) => ds.writeOptionCompanies(items),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.optCompanies(ds.id) }),
  });
}

export function useWriteOptionGrantsMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: (items: OptionGrant[]) => ds.writeOptionGrants(items),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.optGrants(ds.id) }),
  });
}

export function useWriteOptionFmvMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: (items: OptionFmv[]) => ds.writeOptionFmv(items),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.optFmv(ds.id) }),
  });
}

export function useWriteOptionExercisesMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: (items: OptionExercise[]) => ds.writeOptionExercises(items),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.optExercises(ds.id) }),
  });
}

// ── Import (full snapshot overwrite) ────────────────────────────────────
export function useImportMutation() {
  const qc = useQueryClient();
  const ds = useDatasource();
  return useMutation({
    mutationFn: (snapshots: Snapshot[]) => ds.writeSnapshots(snapshots),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.snapshots(ds.id) }),
  });
}

import type { QueryClient } from '@tanstack/react-query';
import type { Datasource } from './types';
import type { Account, Snapshot, AppConfig, Tag, Group, Person, FxRate, OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';
import { loadAccounts, loadSnapshots } from '@/api/accounts';
import { loadConfig, writeConfig } from '@/api/config';
import { loadTagsCatalog, writeTagsCatalog } from '@/api/tags';
import { loadGroupsCatalog, writeGroupsCatalog } from '@/api/groups';
import { loadPeopleCatalog, writePeopleCatalog } from '@/api/people';
import { loadFxRates, writeFxRates } from '@/api/fx';
import { loadOptionCompanies, loadOptionGrants, loadOptionFmv, loadOptionExercises, writeOptionCompanies, writeOptionGrants, writeOptionFmv, writeOptionExercises } from '@/api/options';
import { safeWriteTab } from '@/api/sheets';
import { HEADERS } from '@/constants';
import { qk } from '@/queries/keys';
import { serializeAccounts, serializeSnapshots } from './parse';

export class SheetsDatasource implements Datasource {
  readonly kind = 'sheets';

  constructor(
    readonly id: string,
    private readonly qc: QueryClient,
  ) {}

  private prev<T>(key: readonly unknown[]): number {
    return (this.qc.getQueryData<T[]>(key as unknown[]) ?? []).length;
  }

  loadAccounts()        { return loadAccounts(this.id); }
  loadSnapshots()       { return loadSnapshots(this.id); }
  loadConfig()          { return loadConfig(this.id); }
  loadTags()            { return loadTagsCatalog(this.id); }
  loadGroups()          { return loadGroupsCatalog(this.id); }
  loadPeople()          { return loadPeopleCatalog(this.id); }
  loadFxRates()         { return loadFxRates(this.id); }
  loadOptionCompanies() { return loadOptionCompanies(this.id); }
  loadOptionGrants()    { return loadOptionGrants(this.id); }
  loadOptionFmv()       { return loadOptionFmv(this.id); }
  loadOptionExercises() { return loadOptionExercises(this.id); }

  async writeAccounts(accounts: Account[]): Promise<void> {
    const rows = serializeAccounts(accounts);
    await safeWriteTab(this.id, 'accounts', rows, this.prev(qk.accounts(this.id)));
  }

  async writeSnapshots(snapshots: Snapshot[]): Promise<void> {
    const rows = serializeSnapshots(snapshots);
    await safeWriteTab(this.id, 'snapshots', rows, this.prev(qk.snapshots(this.id)));
  }

  async writeConfig(key: keyof AppConfig, value: string): Promise<void> {
    await writeConfig(this.id, key, value);
  }

  async writeTags(tags: Tag[]): Promise<void> {
    await writeTagsCatalog(this.id, tags, this.prev(qk.tags(this.id)));
  }

  async writeGroups(groups: Group[]): Promise<void> {
    await writeGroupsCatalog(this.id, groups, this.prev(qk.groups(this.id)));
  }

  async writePeople(people: Person[]): Promise<void> {
    await writePeopleCatalog(this.id, people, this.prev(qk.people(this.id)));
  }

  async writeFxRates(rates: FxRate[]): Promise<void> {
    await writeFxRates(this.id, rates, this.prev(qk.fxRates(this.id)));
  }

  async writeOptionCompanies(items: OptionCompany[]): Promise<void> {
    const rows: unknown[][] = items.length
      ? [HEADERS.option_companies as unknown as string[], ...items.map(c => HEADERS.option_companies.map(h => {
          if (h === 'active') return c.active === false ? 'FALSE' : 'TRUE';
          if (h === 'tags') return c.tags.join(', ');
          return (c as unknown as Record<string, unknown>)[h] ?? '';
        }))]
      : [HEADERS.option_companies as unknown as string[]];
    await safeWriteTab(this.id, 'option_companies', rows, this.prev(qk.optCompanies(this.id)));
  }

  async writeOptionGrants(items: OptionGrant[]): Promise<void> {
    const rows: unknown[][] = items.length
      ? [HEADERS.option_grants as unknown as string[], ...items.map(g => HEADERS.option_grants.map(h => (g as unknown as Record<string, unknown>)[h] ?? ''))]
      : [HEADERS.option_grants as unknown as string[]];
    await safeWriteTab(this.id, 'option_grants', rows, this.prev(qk.optGrants(this.id)));
  }

  async writeOptionFmv(items: OptionFmv[]): Promise<void> {
    const rows: unknown[][] = items.length
      ? [HEADERS.option_fmv as unknown as string[], ...items.map(f => HEADERS.option_fmv.map(h => (f as unknown as Record<string, unknown>)[h] ?? ''))]
      : [HEADERS.option_fmv as unknown as string[]];
    await safeWriteTab(this.id, 'option_fmv', rows, this.prev(qk.optFmv(this.id)));
  }

  async writeOptionExercises(items: OptionExercise[]): Promise<void> {
    const rows: unknown[][] = items.length
      ? [HEADERS.option_exercises as unknown as string[], ...items.map(e => HEADERS.option_exercises.map(h => (e as unknown as Record<string, unknown>)[h] ?? ''))]
      : [HEADERS.option_exercises as unknown as string[]];
    await safeWriteTab(this.id, 'option_exercises', rows, this.prev(qk.optExercises(this.id)));
  }
}

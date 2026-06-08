import type { Account, Snapshot, AppConfig, Tag, Group, FxRate, OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';

export interface Datasource {
  readonly id: string;
  readonly kind: string;

  loadAccounts(): Promise<Account[]>;
  loadSnapshots(): Promise<Snapshot[]>;
  loadConfig(): Promise<Partial<AppConfig>>;
  loadTags(): Promise<Tag[]>;
  loadGroups(): Promise<Group[]>;
  loadFxRates(): Promise<FxRate[]>;
  loadOptionCompanies(): Promise<OptionCompany[]>;
  loadOptionGrants(): Promise<OptionGrant[]>;
  loadOptionFmv(): Promise<OptionFmv[]>;
  loadOptionExercises(): Promise<OptionExercise[]>;

  writeAccounts(accounts: Account[]): Promise<void>;
  writeSnapshots(snapshots: Snapshot[]): Promise<void>;
  writeConfig(key: keyof AppConfig, value: string): Promise<void>;
  writeTags(tags: Tag[]): Promise<void>;
  writeGroups(groups: Group[]): Promise<void>;
  writeFxRates(rates: FxRate[]): Promise<void>;
  writeOptionCompanies(items: OptionCompany[]): Promise<void>;
  writeOptionGrants(items: OptionGrant[]): Promise<void>;
  writeOptionFmv(items: OptionFmv[]): Promise<void>;
  writeOptionExercises(items: OptionExercise[]): Promise<void>;
}

import * as XLSX from 'xlsx';
import type { Datasource } from './types';
import type { Account, Snapshot, AppConfig, Tag, Group, FxRate, OptionCompany, OptionGrant, OptionFmv, OptionExercise } from '@/types/sheets';
import { HEADERS } from '@/constants';
import {
  parseAccountRows, parseSnapshotRows, parseConfigRows,
  parseTagRows, parseGroupRows, parseFxRateRows,
  parseOptionCompanyRows, parseOptionGrantRows, parseOptionFmvRows, parseOptionExerciseRows,
  serializeAccounts, serializeSnapshots, serializeConfig,
  serializeTags, serializeGroups, serializeFxRates,
  serializeOptionCompanies, serializeOptionGrants, serializeOptionFmv, serializeOptionExercises,
} from './parse';

function sheetToAoa(wb: XLSX.WorkBook, name: string): unknown[][] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });
}

function aoaToSheet(rows: unknown[][]): XLSX.WorkSheet {
  return XLSX.utils.aoa_to_sheet(rows);
}

export class XlsxDatasource implements Datasource {
  readonly kind = 'xlsx';
  readonly id = '__xlsx__';

  constructor(
    private wb: XLSX.WorkBook,
    readonly filename: string,
  ) {}

  static async fromFile(file: File): Promise<XlsxDatasource> {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: false });
    return new XlsxDatasource(wb, file.name);
  }

  static createEmpty(filename = 'net-worth.xlsx'): XlsxDatasource {
    const wb = XLSX.utils.book_new();
    const tabs: [string, readonly string[]][] = [
      ['accounts',         HEADERS.accounts],
      ['snapshots',        HEADERS.snapshots],
      ['config',           HEADERS.config],
      ['tags',             HEADERS.tags],
      ['groups',           HEADERS.groups],
      ['fx_rates',         HEADERS.fx_rates],
      ['option_companies', HEADERS.option_companies],
      ['option_grants',    HEADERS.option_grants],
      ['option_fmv',       HEADERS.option_fmv],
      ['option_exercises', HEADERS.option_exercises],
    ];
    for (const [name, headers] of tabs) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...headers]]), name);
    }
    return new XlsxDatasource(wb, filename);
  }

  private read(tab: string): unknown[][] {
    return sheetToAoa(this.wb, tab);
  }

  private write(tab: string, rows: unknown[][]): void {
    this.wb.Sheets[tab] = aoaToSheet(rows);
    if (!this.wb.SheetNames.includes(tab)) this.wb.SheetNames.push(tab);
  }

  loadAccounts()        { return Promise.resolve(parseAccountRows(this.read('accounts'))); }
  loadSnapshots()       { return Promise.resolve(parseSnapshotRows(this.read('snapshots'))); }
  loadConfig()          { return Promise.resolve(parseConfigRows(this.read('config'))); }
  loadTags()            { return Promise.resolve(parseTagRows(this.read('tags'))); }
  loadGroups()          { return Promise.resolve(parseGroupRows(this.read('groups'))); }
  loadFxRates()         { return Promise.resolve(parseFxRateRows(this.read('fx_rates'))); }
  loadOptionCompanies() { return Promise.resolve(parseOptionCompanyRows(this.read('option_companies'))); }
  loadOptionGrants()    { return Promise.resolve(parseOptionGrantRows(this.read('option_grants'))); }
  loadOptionFmv()       { return Promise.resolve(parseOptionFmvRows(this.read('option_fmv'))); }
  loadOptionExercises() { return Promise.resolve(parseOptionExerciseRows(this.read('option_exercises'))); }

  async writeAccounts(accounts: Account[])         { this.write('accounts', serializeAccounts(accounts)); }
  async writeSnapshots(snapshots: Snapshot[])     { this.write('snapshots', serializeSnapshots(snapshots)); }
  async writeTags(tags: Tag[])                    { this.write('tags', serializeTags(tags)); }
  async writeGroups(groups: Group[])              { this.write('groups', serializeGroups(groups)); }
  async writeFxRates(rates: FxRate[])             { this.write('fx_rates', serializeFxRates(rates)); }
  async writeOptionCompanies(items: OptionCompany[]) { this.write('option_companies', serializeOptionCompanies(items)); }
  async writeOptionGrants(items: OptionGrant[])   { this.write('option_grants', serializeOptionGrants(items)); }
  async writeOptionFmv(items: OptionFmv[])        { this.write('option_fmv', serializeOptionFmv(items)); }
  async writeOptionExercises(items: OptionExercise[]) { this.write('option_exercises', serializeOptionExercises(items)); }

  async writeConfig(key: keyof AppConfig, value: string): Promise<void> {
    const rows = this.read('config');
    const idx = (rows as string[][]).findIndex((r, i) => i > 0 && r[0] === key);
    if (idx >= 1) {
      (rows[idx] as unknown[])[1] = value;
    } else {
      rows.push([key, value]);
    }
    this.write('config', rows);
  }

  downloadXlsx(): void {
    XLSX.writeFile(this.wb, this.filename, { bookType: 'xlsx' });
  }
}

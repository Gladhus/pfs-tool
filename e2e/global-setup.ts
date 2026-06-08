import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['id', 'type', 'name_fr', 'name_en', 'category', 'kind', 'owner', 'ownership_share', 'active', 'sort_order', 'tags', 'annual_rate', 'currency'],
      ['tfsa_1',     'tfsa',     'CELI 1',        'TFSA 1',     'investments',      'asset', 'self',  1.0, 'true', 10, '', '', ''],
      ['checking_1', 'checking', 'Compte chèque', 'Checking',   'cash',             'asset', 'self',  1.0, 'true', 20, '', '', ''],
      ['mortgage_1', 'mortgage', 'Hypothèque',    'Mortgage',   'real_estate_debt', 'debt',  'joint', 0.5, 'true', 10, '', '', ''],
    ]),
    'accounts',
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['date', 'account_id', 'balance_raw', 'comment', 'entered_at'],
      ['2024-01-01', 'tfsa_1',     50000,    '', '2024-01-01T00:00:00Z'],
      ['2024-01-01', 'checking_1',  5000,    '', '2024-01-01T00:00:00Z'],
      ['2024-01-01', 'mortgage_1', -300000,  '', '2024-01-01T00:00:00Z'],
      ['2024-06-01', 'tfsa_1',     55000,    '', '2024-06-01T00:00:00Z'],
      ['2024-06-01', 'checking_1',  6000,    '', '2024-06-01T00:00:00Z'],
      ['2024-06-01', 'mortgage_1', -295000,  '', '2024-06-01T00:00:00Z'],
    ]),
    'snapshots',
  );

  // Config includes language: en so useSyncPreferencesFromConfig keeps the app in English
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([['key', 'value'], ['language', 'en']]),
    'config',
  );

  const headerOnlySheets: Record<string, string[]> = {
    tags:             ['name'],
    groups:           ['name', 'color', 'all', 'any', 'exclude'],
    fx_rates:         ['date', 'usd_cad'],
    option_companies: ['id', 'name', 'ticker', 'active', 'tags', 'currency'],
    option_grants:    ['id', 'company_id', 'label', 'grant_type', 'grant_date', 'total_shares', 'strike_price', 'vesting_start', 'cliff_months', 'vesting_months', 'vesting_interval', 'expiry_date'],
    option_fmv:       ['date', 'company_id', 'fmv', 'note'],
    option_exercises: ['id', 'grant_id', 'date', 'shares_exercised', 'price_paid', 'note'],
  };
  for (const [name, header] of Object.entries(headerOnlySheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header]), name);
  }

  const fixturesDir = resolve(__dirname, 'fixtures');
  mkdirSync(fixturesDir, { recursive: true });
  writeFileSync(
    resolve(fixturesDir, 'sample.xlsx'),
    XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer,
  );
}

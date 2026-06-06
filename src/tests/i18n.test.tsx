import { describe, it, expect } from 'vitest';
import '@/i18n';
import i18n from '@/i18n';

describe('i18n', () => {
  it('initialises with lang en (ui.store default)', () => {
    expect(i18n.language).toBe('en');
  });

  it('t("app_name") resolves to "Net Worth Tracker", not the raw key', () => {
    const val = i18n.t('app_name');
    expect(val).toBe('Net Worth Tracker');
    expect(val).not.toBe('app_name');
  });

  it('switches to fr and resolves app_name', () => {
    i18n.changeLanguage('fr');
    expect(i18n.t('app_name')).toBe('Net Worth Tracker');
    i18n.changeLanguage('en');
  });

  it('has all required auth keys in en', () => {
    const keys = ['signed_out_p1', 'signed_out_p2', 'reset_link', 'bootstrap_failed'];
    for (const k of keys) {
      const val = i18n.t(k);
      expect(val, `missing key: ${k}`).not.toBe(k);
    }
  });

  it('has all required auth keys in fr', () => {
    i18n.changeLanguage('fr');
    const keys = ['signed_out_p1', 'signed_out_p2', 'reset_link', 'bootstrap_failed'];
    for (const k of keys) {
      const val = i18n.t(k);
      expect(val, `missing fr key: ${k}`).not.toBe(k);
    }
    i18n.changeLanguage('en');
  });
});

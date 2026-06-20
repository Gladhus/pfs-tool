import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/shared/stores/auth.store';
import { useUIStore } from '@/shared/stores/ui.store';
import { useDialogStore } from '@/shared/stores/dialog.store';
import { LEGACY_SELF_ID, HOUSEHOLD_VIEWER } from '@/shared/utils/ownership';

beforeEach(() => {
  useAuthStore.setState({
    gapiReady: false, gisReady: false, accessToken: null, expiresAt: null,
    sheetId: null, userEmail: null, isBootstrapping: false,
    isDataLoaded: false, sessionRestoreAttempted: false, bootstrapError: null,
  });
  useUIStore.setState({ privateMode: false, lang: 'en', theme: 'system', ovSeriesVisible: {}, ovView: 'category', currentViewer: LEGACY_SELF_ID });
  useDialogStore.setState({ activeDialog: null, onConfirm: null });
});

describe('auth.store', () => {
  it('setToken stores access token and expiry', () => {
    useAuthStore.getState().setToken('tok-123', 9999);
    const { accessToken, expiresAt } = useAuthStore.getState();
    expect(accessToken).toBe('tok-123');
    expect(expiresAt).toBe(9999);
  });

  it('clearToken nulls the token', () => {
    useAuthStore.getState().setToken('tok-123', 9999);
    useAuthStore.getState().clearToken();
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('setSheetId stores the id', () => {
    useAuthStore.getState().setSheetId('sheet-abc');
    expect(useAuthStore.getState().sheetId).toBe('sheet-abc');
  });
});

describe('ui.store', () => {
  it('lang defaults to "en"', () => {
    expect(useUIStore.getState().lang).toBe('en');
  });

  it('setLang changes language', () => {
    useUIStore.getState().setLang('fr');
    expect(useUIStore.getState().lang).toBe('fr');
  });

  it('togglePrivateMode flips the flag', () => {
    expect(useUIStore.getState().privateMode).toBe(false);
    useUIStore.getState().togglePrivateMode();
    expect(useUIStore.getState().privateMode).toBe(true);
    useUIStore.getState().togglePrivateMode();
    expect(useUIStore.getState().privateMode).toBe(false);
  });

  it('has no activeTab field (was removed in Phase 1)', () => {
    expect('activeTab' in useUIStore.getState()).toBe(false);
  });

  it('setTheme changes theme', () => {
    useUIStore.getState().setTheme('dark');
    expect(useUIStore.getState().theme).toBe('dark');
  });

  it('currentViewer defaults to the legacy self id', () => {
    expect(useUIStore.getState().currentViewer).toBe(LEGACY_SELF_ID);
  });

  it('setCurrentViewer switches to another person or the household sentinel', () => {
    useUIStore.getState().setCurrentViewer('partner');
    expect(useUIStore.getState().currentViewer).toBe('partner');
    useUIStore.getState().setCurrentViewer(HOUSEHOLD_VIEWER);
    expect(useUIStore.getState().currentViewer).toBe(HOUSEHOLD_VIEWER);
  });
});

describe('dialog.store', () => {
  it('activeDialog is null by default', () => {
    expect(useDialogStore.getState().activeDialog).toBeNull();
  });

  it('openDialog sets the active dialog', () => {
    useDialogStore.getState().openDialog('account');
    expect(useDialogStore.getState().activeDialog).toBe('account');
  });

  it('openDialog stores onConfirm callback', () => {
    const cb = () => {};
    useDialogStore.getState().openDialog('confirm', cb);
    expect(useDialogStore.getState().onConfirm).toBe(cb);
  });

  it('closeDialog resets to null', () => {
    useDialogStore.getState().openDialog('group');
    useDialogStore.getState().closeDialog();
    expect(useDialogStore.getState().activeDialog).toBeNull();
    expect(useDialogStore.getState().onConfirm).toBeNull();
  });

  it('supports all discriminated union values', () => {
    const dialogs = ['account', 'migrate', 'group', 'confirm'] as const;
    for (const d of dialogs) {
      useDialogStore.getState().openDialog(d);
      expect(useDialogStore.getState().activeDialog).toBe(d);
    }
  });
});

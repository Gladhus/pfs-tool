import type { Account, OptionCompany, OwnershipEntry, Person } from '@/types/sheets';

/** Ids baked into DEFAULT_PEOPLE — used only to migrate legacy owner/ownership_share data. */
export const LEGACY_SELF_ID = 'self';
export const LEGACY_PARTNER_ID = 'partner';
export const LEGACY_JOINT_OWNER = 'joint';

/** Sentinel "viewer" representing the whole household (every owner combined), rather than one person. */
export const HOUSEHOLD_VIEWER = '__household__';

export function parseOwnership(raw: unknown): OwnershipEntry[] {
  if (Array.isArray(raw)) {
    return raw
      .map(e => ({ person_id: String((e as OwnershipEntry).person_id ?? ''), share: Number((e as OwnershipEntry).share) }))
      .filter(e => e.person_id && Number.isFinite(e.share) && e.share >= 0);
  }
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return parseOwnership(parsed);
  } catch {
    return [];
  }
}

export function serializeOwnership(ownership: OwnershipEntry[]): string {
  return JSON.stringify(ownership);
}

/** Migrates a legacy single owner + ownership_share pair (pre-ownership-array sheets) into the array form. */
export function migrateLegacyOwnership(owner: unknown, ownershipShare: unknown): OwnershipEntry[] {
  const ownerStr = String(owner ?? '').trim() || LEGACY_SELF_ID;
  const share = Number(ownershipShare);
  const selfShare = Number.isFinite(share) ? Math.max(0, Math.min(1, share)) : 1;
  if (ownerStr === LEGACY_JOINT_OWNER) {
    return [
      { person_id: LEGACY_SELF_ID, share: selfShare },
      { person_id: LEGACY_PARTNER_ID, share: 1 - selfShare },
    ];
  }
  return [{ person_id: ownerStr, share: 1 }];
}

/** Reads the `ownership` field of a parsed sheet row, falling back to legacy owner/ownership_share columns. */
export function ownershipFromRow(obj: Record<string, unknown>): OwnershipEntry[] {
  const parsed = parseOwnership(obj.ownership);
  if (parsed.length) return parsed;
  return migrateLegacyOwnership(obj.owner, obj.ownership_share);
}

export function shareFor(ownership: OwnershipEntry[], personId: string): number {
  return ownership.filter(o => o.person_id === personId).reduce((sum, o) => sum + o.share, 0);
}

export function totalShare(ownership: OwnershipEntry[]): number {
  return ownership.reduce((sum, o) => sum + o.share, 0);
}

/** A viewer's share of an account: one person's share, or everyone's combined for HOUSEHOLD_VIEWER. */
export function viewerShare(ownership: OwnershipEntry[], viewer: string): number {
  return viewer === HOUSEHOLD_VIEWER ? totalShare(ownership) : shareFor(ownership, viewer);
}

/** Whether a single-owner item (e.g. an option company) should be visible to the given viewer. */
export function ownerVisibleToViewer(ownerId: string, viewer: string): boolean {
  return viewer === HOUSEHOLD_VIEWER || viewer === ownerId;
}

/** Accounts the viewer has any stake in — i.e. excludes accounts they own 0% of. */
export function accountsVisibleToViewer(accounts: Account[], viewer: string): Account[] {
  return accounts.filter(a => viewerShare(a.ownership, viewer) > 0);
}

/**
 * Ensures exactly one person is flagged `primary`. Sheets written before the `primary`
 * column existed (or any row data that lost the flag) fall back to LEGACY_SELF_ID, or the
 * first person if that id isn't present.
 */
export function ensurePrimaryPerson(people: Person[]): Person[] {
  if (!people.length || people.some(p => p.primary)) return people;
  const fallbackId = people.find(p => p.id === LEGACY_SELF_ID)?.id ?? people[0].id;
  return people.map(p => p.id === fallbackId ? { ...p, primary: true } : p);
}

/** Whether a person still has a stake in any active account or owns any active option company. Archived accounts/companies don't count. */
export function personHasActiveClaims(personId: string, accounts: Account[], companies: OptionCompany[]): boolean {
  if (accounts.some(a => a.active && shareFor(a.ownership, personId) > 0)) return true;
  if (companies.some(c => c.active && c.owner === personId)) return true;
  return false;
}

export type OwnershipIssue =
  | { kind: 'unbalanced_account'; accountId: string; pct: number }
  | { kind: 'unknown_account_owner'; accountId: string; personId: string }
  | { kind: 'unknown_company_owner'; companyId: string; personId: string };

/**
 * Flags ownership data that's inconsistent with the current people list: active accounts whose
 * shares don't sum to 100%, and active accounts/companies referencing an unknown or archived person.
 */
export function auditOwnership(accounts: Account[], companies: OptionCompany[], people: Person[]): OwnershipIssue[] {
  const knownIds = new Set(people.filter(p => p.active).map(p => p.id));
  const issues: OwnershipIssue[] = [];
  for (const a of accounts) {
    if (!a.active) continue;
    const pct = Math.round(totalShare(a.ownership) * 100);
    if (pct !== 100) issues.push({ kind: 'unbalanced_account', accountId: a.id, pct });
    for (const personId of new Set(a.ownership.map(o => o.person_id))) {
      if (!knownIds.has(personId)) issues.push({ kind: 'unknown_account_owner', accountId: a.id, personId });
    }
  }
  for (const c of companies) {
    if (!c.active) continue;
    if (!knownIds.has(c.owner)) issues.push({ kind: 'unknown_company_owner', companyId: c.id, personId: c.owner });
  }
  return issues;
}

/** Human-readable "Name 50% · Partner 50%" (or just "Name" for a single full owner). */
export function ownershipLabel(ownership: OwnershipEntry[], people: Person[], jointFallback: string): string {
  if (!ownership.length) return jointFallback;
  return ownership.map(o => {
    const name = people.find(p => p.id === o.person_id)?.name || o.person_id;
    return ownership.length > 1 ? `${name} ${Math.round(o.share * 100)}%` : name;
  }).join(' · ');
}

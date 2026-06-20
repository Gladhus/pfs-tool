import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

// useOverviewStats labels buckets via `tr`; stub it so labels are stable English
// and importing the i18n module has no init side effects.
vi.mock('@/shared/i18n', () => ({
  default: { changeLanguage: vi.fn() },
  tr: (e: { name_en?: string; name_fr?: string }) => e.name_en ?? e.name_fr ?? '',
}));

import { useOverviewStats } from '@/features/networth/useOverviewStats';
import { overviewParams } from '../fixtures/portfolio';
import { HOUSEHOLD_VIEWER } from '@/shared/utils/ownership';

/**
 * GOLDEN MASTER — these snapshots freeze the numbers the Overview produces today,
 * so the `src/core/` data-layer migration cannot silently drift them. If a change
 * is intentional, re-bless with `vitest -u` and call it out in review.
 */
function snapshot(stats: ReturnType<typeof useOverviewStats>) {
  return {
    netWorth: stats.netWorth,
    prevNetWorth: stats.prevNetWorth,
    byCategory: stats.byCategory,
    prevByCategory: stats.prevByCategory,
    chartDates: stats.chartDates,
    netData: stats.netData,
    buckets: stats.bucketData.map(b => ({ key: b.key, label: b.label, data: b.data })),
    groupStats: stats.groupStats.map(g => ({ name: g.group.name, value: g.value, prevValue: g.prevValue })),
    personStats: stats.personStats.map(p => ({ id: p.person.id, value: p.value, prevValue: p.prevValue })),
  };
}

const run = (over: Parameters<typeof overviewParams>[0]) =>
  snapshot(renderHook(() => useOverviewStats(overviewParams(over))).result.current);

describe('GOLDEN useOverviewStats', () => {
  it('category view, viewer = self (leading 2021 trims away)', () => {
    expect(run({ view: 'category', viewer: 'self' })).toMatchInlineSnapshot(`
      {
        "buckets": [
          {
            "data": [
              24000,
              29500,
              34500,
            ],
            "key": "investments",
            "label": "Investments",
          },
          {
            "data": [
              1300,
              1620,
              1680,
            ],
            "key": "cash",
            "label": "Cash",
          },
          {
            "data": [
              50000,
              55000,
              65000,
            ],
            "key": "real_estate",
            "label": "Real Estate",
          },
          {
            "data": [
              null,
              1800,
              6352.5,
            ],
            "key": "equity",
            "label": "equity",
          },
        ],
        "byCategory": {
          "cash": 1680,
          "equity": 11340,
          "investments": 34500,
          "real_estate": 65000,
        },
        "chartDates": [
          "2022-02-01",
          "2023-05-10",
          "2024-06-01",
        ],
        "groupStats": [
          {
            "name": "Tech",
            "prevValue": 0,
            "value": 41340,
          },
        ],
        "netData": [
          75300,
          87920,
          107532.5,
        ],
        "netWorth": 112520,
        "personStats": [
          {
            "id": "self",
            "prevValue": 0,
            "value": 112520,
          },
          {
            "id": "partner",
            "prevValue": 10000,
            "value": 84500,
          },
        ],
        "prevByCategory": {
          "investments": 0,
        },
        "prevNetWorth": 0,
      }
    `);
  });

  it('category view, viewer = household (all dates)', () => {
    expect(run({ view: 'category', viewer: HOUSEHOLD_VIEWER })).toMatchInlineSnapshot(`
      {
        "buckets": [
          {
            "data": [
              10000,
              38000,
              44000,
              54000,
            ],
            "key": "investments",
            "label": "Investments",
          },
          {
            "data": [
              null,
              1300,
              1620,
              1680,
            ],
            "key": "cash",
            "label": "Cash",
          },
          {
            "data": [
              null,
              100000,
              110000,
              130000,
            ],
            "key": "real_estate",
            "label": "Real Estate",
          },
          {
            "data": [
              null,
              null,
              1800,
              6352.5,
            ],
            "key": "equity",
            "label": "equity",
          },
        ],
        "byCategory": {
          "cash": 1680,
          "equity": 11340,
          "investments": 54000,
          "real_estate": 130000,
        },
        "chartDates": [
          "2021-03-15",
          "2022-02-01",
          "2023-05-10",
          "2024-06-01",
        ],
        "groupStats": [
          {
            "name": "Tech",
            "prevValue": 0,
            "value": 41340,
          },
        ],
        "netData": [
          10000,
          139300,
          157420,
          192032.5,
        ],
        "netWorth": 197020,
        "personStats": [
          {
            "id": "self",
            "prevValue": 0,
            "value": 112520,
          },
          {
            "id": "partner",
            "prevValue": 10000,
            "value": 84500,
          },
        ],
        "prevByCategory": {
          "investments": 10000,
        },
        "prevNetWorth": 10000,
      }
    `);
  });

  it('group view, viewer = household', () => {
    expect(run({ view: 'group', viewer: HOUSEHOLD_VIEWER })).toMatchInlineSnapshot(`
      {
        "buckets": [
          {
            "data": [
              null,
              20000,
              26800,
              36352.5,
            ],
            "key": "group:Tech",
            "label": "Tech",
          },
        ],
        "byCategory": {
          "cash": 1680,
          "equity": 11340,
          "investments": 54000,
          "real_estate": 130000,
        },
        "chartDates": [
          "2021-03-15",
          "2022-02-01",
          "2023-05-10",
          "2024-06-01",
        ],
        "groupStats": [
          {
            "name": "Tech",
            "prevValue": 0,
            "value": 41340,
          },
        ],
        "netData": [
          10000,
          139300,
          157420,
          192032.5,
        ],
        "netWorth": 197020,
        "personStats": [
          {
            "id": "self",
            "prevValue": 0,
            "value": 112520,
          },
          {
            "id": "partner",
            "prevValue": 10000,
            "value": 84500,
          },
        ],
        "prevByCategory": {
          "investments": 10000,
        },
        "prevNetWorth": 10000,
      }
    `);
  });

  it('person view, viewer = household', () => {
    expect(run({ view: 'person', viewer: HOUSEHOLD_VIEWER })).toMatchInlineSnapshot(`
      {
        "buckets": [
          {
            "data": [
              null,
              75300,
              87920,
              107532.5,
            ],
            "key": "person:self",
            "label": "Me",
          },
          {
            "data": [
              10000,
              64000,
              69500,
              84500,
            ],
            "key": "person:partner",
            "label": "Partner",
          },
        ],
        "byCategory": {
          "cash": 1680,
          "equity": 11340,
          "investments": 54000,
          "real_estate": 130000,
        },
        "chartDates": [
          "2021-03-15",
          "2022-02-01",
          "2023-05-10",
          "2024-06-01",
        ],
        "groupStats": [
          {
            "name": "Tech",
            "prevValue": 0,
            "value": 41340,
          },
        ],
        "netData": [
          10000,
          139300,
          157420,
          192032.5,
        ],
        "netWorth": 197020,
        "personStats": [
          {
            "id": "self",
            "prevValue": 0,
            "value": 112520,
          },
          {
            "id": "partner",
            "prevValue": 10000,
            "value": 84500,
          },
        ],
        "prevByCategory": {
          "investments": 10000,
        },
        "prevNetWorth": 10000,
      }
    `);
  });

  it('category view, viewer = partner', () => {
    expect(run({ view: 'category', viewer: 'partner' })).toMatchInlineSnapshot(`
      {
        "buckets": [
          {
            "data": [
              10000,
              14000,
              14500,
              19500,
            ],
            "key": "investments",
            "label": "Investments",
          },
          {
            "data": [
              null,
              0,
              0,
              0,
            ],
            "key": "cash",
            "label": "Cash",
          },
          {
            "data": [
              null,
              50000,
              55000,
              65000,
            ],
            "key": "real_estate",
            "label": "Real Estate",
          },
          {
            "data": [
              0,
              0,
              0,
              0,
            ],
            "key": "equity",
            "label": "equity",
          },
        ],
        "byCategory": {
          "cash": 0,
          "investments": 19500,
          "real_estate": 65000,
        },
        "chartDates": [
          "2021-03-15",
          "2022-02-01",
          "2023-05-10",
          "2024-06-01",
        ],
        "groupStats": [
          {
            "name": "Tech",
            "prevValue": 0,
            "value": 0,
          },
        ],
        "netData": [
          10000,
          64000,
          69500,
          84500,
        ],
        "netWorth": 84500,
        "personStats": [
          {
            "id": "self",
            "prevValue": 0,
            "value": 112520,
          },
          {
            "id": "partner",
            "prevValue": 10000,
            "value": 84500,
          },
        ],
        "prevByCategory": {
          "investments": 10000,
        },
        "prevNetWorth": 10000,
      }
    `);
  });
});

import { describe, expect, it } from '@jest/globals';
import {
  ADMIN_FEE_ACCOUNT,
  type BudgetCalcConfig,
  type BudgetCalcLine,
  type BudgetCalcOtherPartnerContribution,
  BudgetCalculationService,
} from './budget-calculation.service';

/**
 * Regression test ported from the field-budget prototype's
 * `test/tie-out.test.js`, run against its `test/fixtures/sample_full.json`
 * fixture — "Sample Cluster Project," an explicitly synthetic/fabricated
 * budget (no real project data). Exercises the full engine: 3 fiscal years
 * with partial first/last years (proration), Local(KES)->USD conversion,
 * Bible-Translation vs Other-Costs activities, an in-kind line,
 * partner-funded cash + an explicit contribution (both feeding Other Partner
 * Contributions), service accounts, and a computed admin fee that hits the
 * country's cap.
 *
 * The expected figures are the prototype's own proven output — this is a
 * correctness check on the port, not a re-derivation:
 *   grand total 164272.73, net to funder 143118.88,
 *   other-partner-contributions -15769.23, Bible-Translation % 0.8904,
 *   funder Bible-Translation % 0.87607, cost per language 41068.18,
 *   capped=true.
 */
describe('BudgetCalculationService', () => {
  const service = new BudgetCalculationService();

  describe('computeBudget — sample_full fixture tie-out', () => {
    const config: BudgetCalcConfig = {
      primaryFunderId: 'Seed Company',
      startDate: '2025-01-01',
      endDate: '2026-12-31',
      sensitivity: 'Low',
      country: {
        costOfLivingIndex: 0.71,
        adminFeeCap: 31000,
      },
      inflationRate: 0.03,
      exchangeRate: 130,
      entryCurrencyMode: 'Local',
      displayCurrencyMode: 'USD',
      languageCount: 2,
      adminFeePercent: 0.1,
    };

    // Ported from sample_full.json's `lines` (header rows dropped — they
    // carry no fiscal-year amounts and the engine ignores them).
    const lines: BudgetCalcLine[] = [
      {
        account: 'Salary/Stipend - Translator',
        costType: 'Cash',
        activity: 'Bible Translation',
        funderId: 'Seed Company',
        fiscalYearAmounts: [3000000, 4000000, 1000000],
      },
      {
        account: 'Salary/Stipend - Non Translator',
        costType: 'Cash',
        activity: 'Bible Translation',
        funderId: 'Seed Company',
        fiscalYearAmounts: [1500000, 2000000, 500000],
      },
      {
        account: 'Travel Expense',
        costType: 'Cash',
        activity: 'Bible Translation',
        funderId: 'Seed Company',
        fiscalYearAmounts: [800000, 900000, 250000],
      },
      {
        account: 'Travel Expense',
        costType: 'In-Kind',
        activity: 'Bible Translation',
        funderId: 'Local partners',
        fiscalYearAmounts: [300000, 300000, 100000],
      },
      {
        account: 'Travel Expense',
        costType: 'Cash',
        activity: 'Other Costs',
        funderId: 'Seed Company',
        fiscalYearAmounts: [600000, 700000, 200000],
      },
      {
        account: 'Meeting/Seminar Expense',
        costType: 'Cash',
        activity: 'Other Costs',
        funderId: 'Seed Company',
        fiscalYearAmounts: [200000, 250000, 80000],
      },
      {
        account: 'Printing',
        costType: 'Cash',
        activity: 'Other Costs',
        funderId: 'Seed Company',
        fiscalYearAmounts: [150000, 0, 0],
      },
      {
        account: 'Office Expense',
        costType: 'Cash',
        activity: 'Bible Translation',
        funderId: 'Partner Org B',
        fiscalYearAmounts: [0, 0, 1200000],
      },
      {
        account: 'Travel Expense',
        costType: 'Cash',
        activity: 'Bible Translation',
        funderId: 'Partner Org B',
        fiscalYearAmounts: [0, 0, 400000],
      },
      {
        account: 'Financial Services',
        costType: 'Cash',
        activity: 'Bible Translation',
        funderId: 'Seed Company',
        fiscalYearAmounts: [250000, 300000, 80000],
      },
      {
        account: 'IT Services',
        costType: 'Cash',
        activity: 'Bible Translation',
        funderId: 'Seed Company',
        fiscalYearAmounts: [200000, 250000, 70000],
      },
      {
        account: 'Telecommunications',
        costType: 'Cash',
        activity: 'Bible Translation',
        funderId: 'Seed Company',
        fiscalYearAmounts: [120000, 150000, 40000],
      },
    ];

    // Ported from sample_full.json's `opc` (one contribution from "Partner Org C").
    const otherPartnerContributions: BudgetCalcOtherPartnerContribution[] = [
      { fiscalYearAmounts: [200000, 200000, 50000] },
    ];

    const result = service.computeBudget(
      config,
      lines,
      otherPartnerContributions,
    );

    const sumTo2dp = (a: readonly number[]) =>
      Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;
    const roundTo5dp = (x: number) => Math.round(x * 1e5) / 1e5;

    it('computes the fiscal-year layout (3 FYs, partial first/last)', () => {
      expect(result?.fiscalYears.duration).toBe(3);
      expect(result?.fiscalYears.monthsPerYear).toEqual([9, 12, 3]);
      expect(result?.fiscalYears.totalMonths).toBe(24);
    });

    it('matches the grand total to the cent', () => {
      expect(sumTo2dp(result!.grandTotal)).toBe(164272.73);
    });

    it('matches net-to-funder to the cent', () => {
      expect(sumTo2dp(result!.netToFunder)).toBe(143118.88);
    });

    it('matches other-partner-contributions to the cent', () => {
      expect(sumTo2dp(result!.otherPartnerContributions)).toBe(-15769.23);
    });

    it('matches the Bible-Translation % to 5 decimal places', () => {
      expect(roundTo5dp(result!.bibleTranslationPercent)).toBe(0.8904);
    });

    it("matches the funder's Bible-Translation % to 5 decimal places", () => {
      expect(roundTo5dp(result!.funderBibleTranslationPercent)).toBe(0.87607);
    });

    it('matches cost-per-language to the cent', () => {
      expect(Math.round(result!.costPerLanguage * 100) / 100).toBe(41068.18);
    });

    it('flags that the computed admin fee hit the country cap', () => {
      expect(result?.capped).toBe(true);
    });
  });

  describe('computeFiscalYears', () => {
    it('returns null when either date is missing', () => {
      expect(service.computeFiscalYears('', '2026-12-31')).toBeNull();
      expect(service.computeFiscalYears('2025-01-01', '')).toBeNull();
    });

    it('handles a single-fiscal-year project (whole-months, no inflation)', () => {
      const fy = service.computeFiscalYears('2025-11-01', '2026-03-31');
      // Oct-start FY: 2025-11 -> startFY 2026; 2026-03 -> endFY 2026. duration=1.
      expect(fy?.duration).toBe(1);
      expect(fy?.monthsPerYear).toEqual([5]);
    });

    it('returns null when the computed end fiscal year precedes the start', () => {
      expect(service.computeFiscalYears('2026-12-31', '2025-01-01')).toBeNull();
    });
  });

  describe('spreadAnnual', () => {
    it('prorates a single-fiscal-year project without compounding inflation', () => {
      const fy = service.computeFiscalYears('2025-11-01', '2026-03-31')!;
      const spread = service.spreadAnnual(12000, fy, 0.03);
      expect(spread).toEqual([12000 * (5 / 12)]);
    });

    it('prorates first/last years and compounds inflation on the years between', () => {
      const fy = service.computeFiscalYears('2025-01-01', '2026-12-31')!;
      const spread = service.spreadAnnual(12000, fy, 0.03);
      expect(spread[0]).toBeCloseTo(12000 * (9 / 12), 2);
      expect(spread[2]).toBeCloseTo(12000 * 1.03 ** 2 * (3 / 12), 2);
    });
  });

  describe('keystoneFigure', () => {
    it('applies the exchange rate only when entry currency is Local', () => {
      expect(
        service.keystoneFigure(0.71, 426.958333333333, 'USD', 130),
      ).toBeCloseTo(0.71 * 426.958333333333, 5);
      expect(
        service.keystoneFigure(0.71, 426.958333333333, 'Local', 130),
      ).toBeCloseTo(0.71 * 426.958333333333 * 130, 5);
    });
  });

  describe('ADMIN_FEE_ACCOUNT', () => {
    it('is excluded from cash/in-kind/allCost and only feeds the admin line', () => {
      const config: BudgetCalcConfig = {
        primaryFunderId: 'Seed Company',
        startDate: '2025-10-01',
        endDate: '2026-09-30',
        sensitivity: 'Low',
        country: null,
        inflationRate: 0,
        exchangeRate: 1,
        entryCurrencyMode: 'USD',
        displayCurrencyMode: 'USD',
        languageCount: 1,
        adminFeePercent: 0,
      };
      const lines: BudgetCalcLine[] = [
        {
          account: ADMIN_FEE_ACCOUNT,
          costType: 'Cash',
          activity: null,
          funderId: null,
          fiscalYearAmounts: [500],
        },
        {
          account: 'Travel Expense',
          costType: 'Cash',
          activity: 'Other Costs',
          funderId: null,
          fiscalYearAmounts: [1000],
        },
      ];
      const result = service.computeBudget(config, lines, []);
      expect(result?.admin).toEqual([500]);
      expect(result?.cash).toEqual([1000]);
      expect(result?.grandTotal).toEqual([1500]);
    });
  });

  describe('header lines', () => {
    it('contributes nothing to any total, matching the prototype\'s `if(ln.type==="header") return;` early-exit', () => {
      const config: BudgetCalcConfig = {
        primaryFunderId: 'Seed Company',
        startDate: '2025-10-01',
        endDate: '2026-09-30',
        sensitivity: 'Low',
        country: null,
        inflationRate: 0,
        exchangeRate: 1,
        entryCurrencyMode: 'USD',
        displayCurrencyMode: 'USD',
        languageCount: 1,
        adminFeePercent: 0,
      };
      // A header row carries only a description in the prototype (no
      // account, and — per this port's schema — no fiscal-year amounts
      // either) but is asserted here with a nonzero amount and even the
      // admin-fee account name to prove it's skipped unconditionally, not
      // just incidentally zeroed out.
      const headerLine: BudgetCalcLine = {
        type: 'header',
        account: ADMIN_FEE_ACCOUNT,
        costType: 'Cash',
        activity: 'Bible Translation',
        funderId: 'Seed Company',
        fiscalYearAmounts: [999999],
      };
      const normalLine: BudgetCalcLine = {
        type: 'line',
        account: 'Travel Expense',
        costType: 'Cash',
        activity: 'Other Costs',
        funderId: null,
        fiscalYearAmounts: [1000],
      };

      const withHeader = service.computeBudget(
        config,
        [headerLine, normalLine],
        [],
      );
      const withoutHeader = service.computeBudget(config, [normalLine], []);

      expect(withHeader?.grandTotal).toEqual([1000]);
      expect(withHeader?.cash).toEqual([1000]);
      expect(withHeader?.admin).toEqual([0]);
      expect(withHeader?.bibleTranslationPercent).toBe(0);
      expect(withHeader).toEqual(withoutHeader);
    });
  });
});

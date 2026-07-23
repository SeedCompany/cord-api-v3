import { Injectable } from '@nestjs/common';

/**
 * Field-budget calculation engine (budget-line-items-poc). Ported 1:1 from
 * the field-budget prototype's `compute()` / `fyInfo()` / `spreadAnnual()` /
 * `keystoneFigure()` / `capPerFy()` (src/app.js in the prototype). Kept as a
 * pure, dependency-free service — no DB access, no NestJS request context —
 * so it's directly unit-testable and safe to call from a resolver/service
 * layer later without any wiring.
 *
 * Deliberately NOT ported here (out of scope for this POC): the interactive
 * benchmark-calculator modal UI itself. `keystoneFigure` /
 * `spreadKeystoneSalary` below are the pure math the modal would call into,
 * with no UI attached.
 */

export type CurrencyMode = 'USD' | 'Local';
export type CostType = 'Cash' | 'In-Kind';

/** The Category-3 account name that carries the manually-entered admin fee. */
export const ADMIN_FEE_ACCOUNT = 'Project Administration Fee';

/** The one activity value that counts toward Bible-Translation %. */
export const BIBLE_TRANSLATION_ACTIVITY = 'Bible Translation';

export interface BudgetCalcCountry {
  readonly costOfLivingIndex: number | null;
  readonly adminFeeCap: number | null;
}

export interface BudgetCalcConfig {
  /** Identifier (or name) of the budget's primary/default funder. */
  readonly primaryFunderId: string;
  /** ISO `YYYY-MM-DD` project start date. */
  readonly startDate: string;
  /** ISO `YYYY-MM-DD` project end date. */
  readonly endDate: string;
  readonly sensitivity: 'Low' | 'Medium' | 'High';
  /** Null when no country is set (or benchmarking isn't in use). */
  readonly country: BudgetCalcCountry | null;
  readonly inflationRate: number;
  readonly exchangeRate: number;
  readonly entryCurrencyMode: CurrencyMode;
  readonly displayCurrencyMode: CurrencyMode;
  readonly languageCount: number;
  readonly adminFeePercent: number;
}

export interface BudgetCalcLine {
  readonly account: string;
  readonly costType: CostType;
  /** e.g. "Bible Translation" | "Other Costs" | null. */
  readonly activity: string | null;
  /** Null defers to `config.primaryFunderId` (the budget's default funder). */
  readonly funderId: string | null;
  /** Amount per fiscal year, ordered to match `FiscalYearInfo.labels`. */
  readonly fiscalYearAmounts: readonly number[];
}

export interface BudgetCalcOtherPartnerContribution {
  readonly fiscalYearAmounts: readonly number[];
}

export interface FiscalYearInfo {
  readonly startFiscalYear: number;
  readonly endFiscalYear: number;
  readonly duration: number;
  readonly firstYearMonths: number;
  readonly lastYearMonths: number;
  readonly monthsPerYear: readonly number[];
  readonly totalMonths: number;
  readonly labels: readonly string[];
}

export interface BudgetCalcResult {
  readonly fiscalYears: FiscalYearInfo;
  readonly cash: readonly number[];
  readonly inKind: readonly number[];
  readonly admin: readonly number[];
  readonly grandTotal: readonly number[];
  readonly totalCash: readonly number[];
  readonly otherPartnerContributions: readonly number[];
  readonly netToFunder: readonly number[];
  readonly bibleTranslationPercent: number;
  readonly funderBibleTranslationPercent: number;
  readonly costPerLanguage: number;
  /** True if the computed admin fee hit the country's cap in >=1 fiscal year. */
  readonly capped: boolean;
  /** Admin-fee cap per fiscal year, in display currency; null if no cap set. */
  readonly adminFeeCap: readonly number[] | null;
}

const round2 = (x: number): number =>
  Math.round((x + Number.EPSILON) * 100) / 100;

const zeros = (n: number): number[] => Array<number>(n).fill(0);

/** `[0, 1, ..., n-1]` — used to drive index-based loops as for..of. */
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

/** Pads/truncates a fiscal-year amounts array to exactly `length`, like the
 * prototype's `ensureFyLen`. */
const padToLength = (arr: readonly number[], length: number): number[] => {
  const out = arr.slice(0, length);
  while (out.length < length) out.push(0);
  return out;
};

const parseIsoDate = (
  s: string,
): { readonly year: number; readonly month: number; readonly day: number } => {
  const parts = s.split('-').map(Number);
  return { year: parts[0]!, month: parts[1]!, day: parts[2]! };
};

@Injectable()
export class BudgetCalculationService {
  /**
   * Ported from `fyInfo()`. Fiscal year runs Oct (month 10) through Sep.
   * Returns `null` when either date is missing or the range is invalid
   * (end fiscal year before start fiscal year).
   */
  computeFiscalYears(
    startDate: string,
    endDate: string,
  ): FiscalYearInfo | null {
    if (!startDate || !endDate) return null;
    const s = parseIsoDate(startDate);
    const e = parseIsoDate(endDate);

    let startFiscalYear: number;
    let firstYearMonths: number;
    if (s.month < 10) {
      startFiscalYear = s.year;
      firstYearMonths = 10 - s.month;
    } else {
      startFiscalYear = s.year + 1;
      firstYearMonths = 22 - s.month;
    }

    let endFiscalYear: number;
    let lastYearMonths: number;
    if (e.month < 10) {
      endFiscalYear = e.year;
      lastYearMonths = e.month + 3;
    } else {
      endFiscalYear = e.year + 1;
      lastYearMonths = e.month - 9;
    }

    if (endFiscalYear < startFiscalYear) return null;

    const duration = endFiscalYear - startFiscalYear + 1;
    const labels: string[] = [];
    for (const i of range(duration)) {
      labels.push(`FY${String(startFiscalYear + i).slice(-2)}`);
    }

    let monthsPerYear: number[];
    if (duration === 1) {
      const wholeMonths = (e.year - s.year) * 12 + (e.month - s.month) + 1;
      monthsPerYear = [Math.max(wholeMonths, 1)];
    } else {
      monthsPerYear = [firstYearMonths];
      for (const _fullYear of range(duration - 2)) monthsPerYear.push(12);
      monthsPerYear.push(lastYearMonths);
    }

    const totalMonths = monthsPerYear.reduce((a, b) => a + b, 0);

    return {
      startFiscalYear,
      endFiscalYear,
      duration,
      firstYearMonths,
      lastYearMonths,
      monthsPerYear,
      totalMonths,
      labels,
    };
  }

  /**
   * Ported from `spreadAnnual()`. Prorates an annual figure across fiscal
   * years: year 0 gets `firstYearMonths/12` of the annual figure; each
   * subsequent full year compounds by `(1+inflationRate)^i`, and the final
   * year is additionally prorated by `lastYearMonths/12`. A single-fiscal-year
   * project just prorates by that year's month count — no inflation applied.
   */
  spreadAnnual(
    annual: number,
    fy: FiscalYearInfo,
    inflationRate: number,
  ): number[] {
    const out: number[] = [];
    for (const i of range(fy.duration)) {
      let amt: number;
      if (fy.duration === 1) {
        amt = annual * (fy.monthsPerYear[0]! / 12);
      } else if (i === 0) {
        amt = annual * (fy.firstYearMonths / 12);
      } else {
        amt = annual * (1 + inflationRate) ** i;
        if (i === fy.duration - 1) amt *= fy.lastYearMonths / 12;
      }
      out.push(round2(amt));
    }
    return out;
  }

  /**
   * Ported from `keystoneFigure()`. Keystone weekly rates are USD-based; this
   * produces a per-week figure in the ENTRY currency.
   */
  keystoneFigure(
    costOfLivingIndex: number,
    weeklyRateUsd: number,
    entryCurrencyMode: CurrencyMode,
    exchangeRate: number,
  ): number {
    const currencyFactor = entryCurrencyMode === 'Local' ? exchangeRate : 1;
    return costOfLivingIndex * weeklyRateUsd * currencyFactor;
  }

  /**
   * Ported from the salary branch of `applyModal()`: spreads a keystone
   * per-week figure across fiscal years by weeks worked that year, compounded
   * by inflation per year index (no first/last-year proration — weeks worked
   * already encodes that).
   */
  spreadKeystoneSalary(
    weeksPerFiscalYear: readonly number[],
    figure: number,
    inflationRate: number,
  ): number[] {
    return weeksPerFiscalYear.map((weeks, i) =>
      round2(weeks * figure * (1 + inflationRate) ** i),
    );
  }

  private effectiveDisplayCurrency(config: BudgetCalcConfig): CurrencyMode {
    return config.sensitivity === 'High'
      ? config.entryCurrencyMode
      : config.displayCurrencyMode;
  }

  /** Entry currency -> display currency conversion factor. */
  private currencyConversionFactor(config: BudgetCalcConfig): number {
    const display = this.effectiveDisplayCurrency(config);
    if (config.entryCurrencyMode === 'USD' && display === 'Local') {
      return config.exchangeRate;
    }
    if (config.entryCurrencyMode === 'Local' && display === 'USD') {
      return 1 / config.exchangeRate;
    }
    return 1;
  }

  /**
   * Ported from `capPerFy()`. Category-3 admin-fee cap per fiscal year, in
   * the ENTRY currency (converted to display currency by the caller like
   * every other monetary array). Null when no country/cap is configured.
   */
  private adminFeeCapPerFiscalYear(
    fy: FiscalYearInfo,
    country: BudgetCalcCountry | null,
    languageCount: number,
    entryCurrencyMode: CurrencyMode,
    exchangeRate: number,
  ): number[] | null {
    if (!country?.adminFeeCap) return null;
    const currencyFactor = entryCurrencyMode === 'Local' ? exchangeRate : 1;
    const capBase = country.adminFeeCap - country.adminFeeCap / 1.1;
    return fy.monthsPerYear.map(
      (monthsThatYear) =>
        capBase * (monthsThatYear / 12) * languageCount * currencyFactor,
    );
  }

  /**
   * Ported from `compute()` — the field-budget summary engine. Returns
   * `null` when the fiscal-year range can't be computed (missing/invalid
   * dates), matching the prototype's behavior.
   */
  computeBudget(
    config: BudgetCalcConfig,
    lines: readonly BudgetCalcLine[],
    otherPartnerContributions: readonly BudgetCalcOtherPartnerContribution[],
  ): BudgetCalcResult | null {
    const fy = this.computeFiscalYears(config.startDate, config.endDate);
    if (!fy) return null;
    const duration = fy.duration;
    const conversionFactor = this.currencyConversionFactor(config);

    const cash = zeros(duration);
    const inKind = zeros(duration);
    const adminManual = zeros(duration);
    const btCost = zeros(duration);
    const allCost = zeros(duration);
    const funderCost = zeros(duration);
    const funderBt = zeros(duration);
    const nonPrimaryCash = zeros(duration);

    for (const line of lines) {
      const amounts = padToLength(line.fiscalYearAmounts, duration);
      const isAdmin = line.account === ADMIN_FEE_ACCOUNT;
      const isCash = line.costType === 'Cash';
      const effectiveFunderId = line.funderId ?? config.primaryFunderId;
      const isFunderPrimary = effectiveFunderId === config.primaryFunderId;
      const isBibleTranslation = line.activity === BIBLE_TRANSLATION_ACTIVITY;

      for (const i of range(duration)) {
        const v = amounts[i] ?? 0;
        if (isAdmin) {
          adminManual[i]! += v;
          continue;
        }
        if (isCash) cash[i]! += v;
        else inKind[i]! += v;
        allCost[i]! += v;
        if (isBibleTranslation) btCost[i]! += v;
        if (isFunderPrimary) {
          funderCost[i]! += v;
          if (isBibleTranslation) funderBt[i]! += v;
        }
        if (isCash && !isFunderPrimary) nonPrimaryCash[i]! += v;
      }
    }

    const pct = config.adminFeePercent || 0;
    const cap = this.adminFeeCapPerFiscalYear(
      fy,
      config.country,
      config.languageCount,
      config.entryCurrencyMode,
      config.exchangeRate,
    );
    const adminComputed = zeros(duration);
    let capped = false;
    for (const i of range(duration)) {
      let fee = (cash[i]! + inKind[i]!) * pct;
      const capForYear = cap ? cap[i]! : Infinity;
      const room = capForYear - adminManual[i]!;
      if (pct > 0 && fee > room) {
        fee = Math.max(room, 0);
        capped = true;
      }
      adminComputed[i] = round2(fee);
    }

    const admin = adminManual.map((m, i) => m + adminComputed[i]!);
    const grandTotal = cash.map((c, i) => c + inKind[i]! + admin[i]!);
    const totalCash = cash.map((c, i) => c + admin[i]!);

    const opc = zeros(duration);
    for (const contribution of otherPartnerContributions) {
      const amounts = padToLength(contribution.fiscalYearAmounts, duration);
      for (const i of range(duration)) opc[i]! -= amounts[i] ?? 0;
    }
    for (const i of range(duration)) opc[i]! -= nonPrimaryCash[i]!;

    const netToFunder = totalCash.map((c, i) => c + opc[i]!);

    const sumArr = (a: readonly number[]) => a.reduce((x, y) => x + y, 0);
    const bibleTranslationPercent =
      sumArr(allCost) !== 0 ? Math.min(sumArr(btCost) / sumArr(allCost), 1) : 0;
    const funderBibleTranslationPercent =
      sumArr(funderCost) !== 0
        ? Math.min(sumArr(funderBt) / sumArr(funderCost), 1)
        : 0;

    const languageCount = config.languageCount || 1;
    const totalProjectCostEntry = sumArr(allCost) + sumArr(admin);
    const costPerLanguage =
      fy.totalMonths > 0
        ? (((totalProjectCostEntry / fy.totalMonths) * 12) / languageCount) *
          conversionFactor
        : 0;

    const convert = (a: readonly number[]) =>
      a.map((x) => x * conversionFactor);

    return {
      fiscalYears: fy,
      cash: convert(cash),
      inKind: convert(inKind),
      admin: convert(admin),
      grandTotal: convert(grandTotal),
      totalCash: convert(totalCash),
      otherPartnerContributions: convert(opc),
      netToFunder: convert(netToFunder),
      bibleTranslationPercent,
      funderBibleTranslationPercent,
      costPerLanguage,
      capped,
      adminFeeCap: cap ? convert(cap) : null,
    };
  }
}

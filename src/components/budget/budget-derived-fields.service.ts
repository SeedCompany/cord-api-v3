import { Injectable } from '@nestjs/common';
import { type ID } from '~/common';
import { EngagementService } from '../engagement';
import { EngagementListInput } from '../engagement/dto';
import { LocationService } from '../location';
import { LocationType } from '../location/dto';
import { PartnerService } from '../partner';
import { PartnershipService } from '../partnership';
import { ProjectService } from '../project';
import { BudgetReferenceCountryRepository } from './budget-reference-country.repository';
import { type BudgetReferenceCountry } from './dto';

/**
 * Small, dedicated service (budget-line-items-poc phase 3) hosting the
 * resolution logic for Budget's two now-purely-computed fields —
 * `Budget.country` and `Budget.languageCount` (see those fields' doc
 * comments in `dto/budget.dto.ts` for why they're no longer manually set).
 * Both are needed from MORE than one call site:
 *   - `BudgetResolver.country` / `BudgetResolver.languageCount` themselves
 *   - `BudgetResolver.calculationSummary`, which previously read the stale
 *     stored `country`/`languageCount` columns directly off the parent DTO
 *   - `BudgetResolver.budgetBenchmark` (the keystone/benchmark calculator),
 *     which needs the resolved country for its rate lookup and the computed
 *     language count for the 4 SERVICE_ACCTS' annual-figure math
 * Factored out here once, rather than duplicated across those call sites or
 * left as inline resolver logic.
 *
 * Uses the underlying domain services directly (`ProjectService.readOne` /
 * `LocationService.readOne` / `EngagementService.list`) rather than
 * `@Loader()`-injected DataLoaders — this needs to be callable from plain
 * service-style code, not just GraphQL field resolvers, and a request-scoped
 * DataLoader can only be obtained via the `@Loader()` param decorator inside
 * an actual resolver method. The trade-off: if a single GraphQL request
 * queries e.g. both `Budget.country` and `Budget.calculationSummary`, the
 * project gets fetched more than once instead of sharing one DataLoader
 * batch. Accepted as a minor, documented inefficiency for this POC — not a
 * correctness issue.
 */
@Injectable()
export class BudgetDerivedFieldsService {
  constructor(
    private readonly projects: ProjectService,
    private readonly locations: LocationService,
    private readonly countries: BudgetReferenceCountryRepository,
    private readonly engagements: EngagementService,
    private readonly partnerships: PartnershipService,
    private readonly partners: PartnerService,
  ) {}

  /**
   * `Budget.country`, purely derived from `Project.primaryLocation` (see
   * that field's doc comment). Never throws for a missing/invalid chain —
   * every step just resolves to `null`:
   *   - no `primaryLocation` set on the project
   *   - the location isn't a `Country`-type location
   *   - the location has no `isoAlpha3` set
   *   - no `budget_reference_countries` row matches that ISO code
   */
  async resolveCountry(
    projectId: ID<'Project'>,
  ): Promise<BudgetReferenceCountry | null> {
    const project = await this.projects.readOne(projectId);
    const locationId = project.primaryLocation.value?.id;
    if (!locationId) {
      return null;
    }

    const location = await this.locations.readOne(locationId);
    if (location.type.value !== LocationType.Country) {
      return null;
    }

    const isoAlpha3 = location.isoAlpha3.value;
    if (!isoAlpha3) {
      return null;
    }

    return await this.countries.findByIsoAlpha3(isoAlpha3);
  }

  /**
   * `Budget.languageCount`, purely derived from the count of the project's
   * Language Engagements. Uses `filter: { project: { id }, type: 'language' }`
   * only — do NOT add anything under `filter.project` beyond `id`; additional
   * `ProjectFilters` sub-keys trip a real, unrelated, pre-existing
   * `NotImplementedException` in `engagement.drizzle.repository.ts`
   * (`engagementFilterClauses`'s `unimplemented` checks), which is out of
   * scope to fix here. `count: 1` since only `.total` is needed — the
   * underlying `paginatedSelect` computes that independent of page size.
   */
  async countLanguageEngagements(projectId: ID<'Project'>): Promise<number> {
    const input = EngagementListInput.defaultValue(EngagementListInput, {
      filter: { project: { id: projectId }, type: 'language' },
      count: 1,
    });
    const list = await this.engagements.list(input);
    return list.total;
  }

  /**
   * The budget's primary funder organization id, for `BudgetCalcConfig.
   * primaryFunderId` — used to decide whether a line's (or the whole
   * budget's default) funder counts as "primary" for netToFunder /
   * funderBibleTranslationPercent / non-primary-cash-as-OPC purposes.
   *
   * Previously always `''` (a placeholder nothing could ever equal) because
   * `Project.primaryPartnership` was stubbed `null` under Postgres — that's
   * now wired (see `project.drizzle.repository.ts`), so this resolves the
   * real chain: Project.primaryPartnership -> Partnership.partner ->
   * Partner.organization. Returns `''` (same placeholder as before) if the
   * project has no primary partnership set, or if the chain somehow can't
   * resolve — never throws, matching `resolveCountry`'s "missing = null/empty,
   * not an error" convention.
   */
  async resolvePrimaryFunderId(projectId: ID<'Project'>): Promise<string> {
    const project = await this.projects.readOne(projectId);
    const partnershipId = project.primaryPartnership.value?.id;
    if (!partnershipId) {
      return '';
    }
    const partnership = await this.partnerships.readOne(partnershipId);
    const partnerId = partnership.partner.value?.id;
    if (!partnerId) {
      return '';
    }
    const partner = await this.partners.readOne(partnerId);
    return partner.organization.value?.id ?? '';
  }
}

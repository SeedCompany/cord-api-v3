import { type ID } from '~/common';
import {
  financialReportingTypeEnum,
  partnerCountries,
  partnerFieldRegions,
  partnerLanguagesOfConsulting,
  partners,
  partnerTypeEnum,
  projectTypeEnum,
} from '~/core/drizzle/schema';
import { type Partner } from '../../../components/partner/dto';
import { PartnerRepository } from '../../../components/partner/partner.repository';
import {
  bulkInsert,
  cypher,
  dateStr,
  linkId,
  orDefault,
  readAllViaRepo,
  sanitizeEnum,
  stat,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * Partner + its three junctions (field_regions, countries, languagesOfConsulting).
 * `departmentIdBlockId` is resolved via the partner→block rel (the DTO's nested
 * block doesn't surface the node id). Language ids are plain text (deferred FK).
 */
export const partnerExtractor: Extractor = {
  name: 'partner',
  targetTables: [
    'partners',
    'partner_field_regions',
    'partner_countries',
    'partner_languages_of_consulting',
  ],
  dependsOn: [
    'organization',
    'user',
    'departmentIdBlock',
    'fieldRegion',
    'location',
  ],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    const dtos = await readAllViaRepo<Partner>(
      ctx,
      'Partner',
      PartnerRepository,
    );

    // partner → departmentIdBlock node id (FK), resolved separately.
    const blockPairs = await cypher<{ pid: ID; bid: ID }>(
      ctx,
      `MATCH (p:Partner)-[:departmentIdBlock { active: true }]->(b:DepartmentIdBlock)
       RETURN p.id AS pid, b.id AS bid`,
    );
    const blockByPartner = new Map(blockPairs.map((r) => [r.pid, r.bid]));

    const droppedEnums = new Set<string>();
    const rows = dtos.map((p) => {
      const types = sanitizeEnum([...p.types], partnerTypeEnum.enumValues);
      const frt = sanitizeEnum(
        [...p.financialReportingTypes],
        financialReportingTypeEnum.enumValues,
      );
      const programs = sanitizeEnum(
        [...p.approvedPrograms],
        projectTypeEnum.enumValues,
      );
      [...types.dropped, ...frt.dropped, ...programs.dropped].forEach((d) =>
        droppedEnums.add(d),
      );
      return {
        id: p.id,
        organizationId: linkId(p.organization)!,
        pointOfContactId: linkId(p.pointOfContact),
        types: types.kept,
        financialReportingTypes: frt.kept,
        pmcEntityCode: p.pmcEntityCode ?? null,
        // NOT NULL (default false) — legacy rows may lack the Property.
        globalInnovationsClient: orDefault(p.globalInnovationsClient, false),
        active: orDefault(p.active, false),
        address: p.address ?? null,
        // Plain text (deferred FK) — may reference not-yet-migrated languages.
        languageOfWiderCommunicationId: linkId(p.languageOfWiderCommunication),
        languageOfReportingId: linkId(p.languageOfReporting),
        startDate: dateStr(p.startDate),
        approvedPrograms: programs.kept,
        departmentIdBlockId: blockByPartner.get(p.id) ?? null,
        // migration-todo: denormalized from projects; 'High' until Project migrates.
        sensitivity: p.sensitivity,
        createdAt: tsReq(p.createdAt),
        // S7 (decided 2026-07-14): carry Neo4j's computed modifiedAt (max
        // property timestamp) — history-accurate + BI-continuous.
        updatedAt: tsReq(p.modifiedAt),
        deletedAt: null,
      };
    });
    if (droppedEnums.size) {
      ctx.log(
        `    ⚠ dropped unknown partner enum value(s): ${[...droppedEnums].join(', ')} — migration-todo: map, don't drop`,
      );
    }
    out.partners = stat(dtos.length, await bulkInsert(ctx, partners, rows));

    const frRows = dtos.flatMap((p) =>
      p.fieldRegions.flatMap((fr) => {
        const fieldRegionId = linkId(fr);
        return fieldRegionId ? [{ partnerId: p.id, fieldRegionId }] : [];
      }),
    );
    out.partner_field_regions = stat(
      frRows.length,
      await bulkInsert(ctx, partnerFieldRegions, frRows),
    );

    const countryRows = dtos.flatMap((p) =>
      p.countries.flatMap((c) => {
        const locationId = linkId(c);
        return locationId ? [{ partnerId: p.id, locationId }] : [];
      }),
    );
    out.partner_countries = stat(
      countryRows.length,
      await bulkInsert(ctx, partnerCountries, countryRows),
    );

    const locRows = dtos.flatMap((p) =>
      p.languagesOfConsulting.flatMap((l) => {
        const languageId = linkId(l);
        return languageId ? [{ partnerId: p.id, languageId }] : [];
      }),
    );
    out.partner_languages_of_consulting = stat(
      locRows.length,
      await bulkInsert(ctx, partnerLanguagesOfConsulting, locRows),
    );

    return out;
  },
};

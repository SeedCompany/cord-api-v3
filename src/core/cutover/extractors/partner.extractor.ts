import { type ID } from '~/common';
import {
  departmentIdBlocks,
  fieldRegions,
  financialReportingTypeEnum,
  locations,
  organizations,
  partnerCountries,
  partnerFieldRegions,
  partnerLanguagesOfConsulting,
  partners,
  partnerTypeEnum,
  projectTypeEnum,
  users,
} from '~/core/drizzle/schema';
import { type Partner } from '../../../components/partner/dto';
import { PartnerRepository } from '../../../components/partner/partner.repository';
import {
  bulkInsert,
  cypher,
  dateStr,
  keepLanded,
  linkId,
  liveTargetIds,
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

    // Prod-finding #2 guards. Every FK below points at a table that legitimately
    // sheds rows (hydrate-drops upstream, unique-conflict drops, soft-deleted
    // parents), and the read here is a superset of what LANDED — so each one is
    // checked against Postgres truth, not against Neo4j liveness.
    //   organization_id is NOT NULL, so a partner whose organization did not land
    //     must be DROPPED. It was previously written as `linkId(p.organization)!`,
    //     and that assertion is not merely cosmetic: the repository OPTIONAL-matches
    //     the organization, so a soft-deleted one yields null, and the `!` carried
    //     it into a NOT NULL column to abort the entire load.
    //   point_of_contact_id and department_id_block_id are nullable, so a missing
    //     target is nulled and logged rather than costing the whole partner.
    const landedOrgs = await liveTargetIds(ctx, 'Organization', organizations);
    const landedUsers = await liveTargetIds(ctx, 'User', users);
    const landedBlocks = await liveTargetIds(
      ctx,
      'DepartmentIdBlock',
      departmentIdBlocks,
    );
    let droppedForOrganization = 0;
    let nulledContacts = 0;
    let nulledBlocks = 0;

    const droppedEnums = new Set<string>();
    const rows = dtos.flatMap((p) => {
      const organizationId = linkId(p.organization);
      if (!organizationId || !landedOrgs.has(organizationId)) {
        droppedForOrganization++;
        return [];
      }
      const pointOfContactId = linkId(p.pointOfContact);
      const contactLanded =
        pointOfContactId && landedUsers.has(pointOfContactId);
      if (pointOfContactId && !contactLanded) nulledContacts++;
      const blockId = blockByPartner.get(p.id) ?? null;
      const blockLanded = blockId && landedBlocks.has(blockId);
      if (blockId && !blockLanded) nulledBlocks++;
      // orDefault, not a bare spread — see the organization extractor: the DTO
      // types these as arrays, but a field Neo4j never wrote arrives undefined
      // and spreading it throws, ending the whole run rather than this row.
      const types = sanitizeEnum(
        [...orDefault(ctx, 'partners.types', p.types, [])],
        partnerTypeEnum.enumValues,
      );
      const frt = sanitizeEnum(
        [
          ...orDefault(
            ctx,
            'partners.financial_reporting_types',
            p.financialReportingTypes,
            [],
          ),
        ],
        financialReportingTypeEnum.enumValues,
      );
      const programs = sanitizeEnum(
        [
          ...orDefault(
            ctx,
            'partners.approved_programs',
            p.approvedPrograms,
            [],
          ),
        ],
        projectTypeEnum.enumValues,
      );
      [...types.dropped, ...frt.dropped, ...programs.dropped].forEach((d) =>
        droppedEnums.add(d),
      );
      return {
        id: p.id,
        organizationId,
        pointOfContactId: contactLanded ? pointOfContactId : null,
        types: types.kept,
        financialReportingTypes: frt.kept,
        pmcEntityCode: p.pmcEntityCode ?? null,
        // NOT NULL (default false) — legacy rows may lack the Property.
        globalInnovationsClient: orDefault(
          ctx,
          'partners.global_innovations_client',
          p.globalInnovationsClient,
          false,
        ),
        active: orDefault(ctx, 'partners.active', p.active, false),
        address: p.address ?? null,
        // Plain text (deferred FK) — may reference not-yet-migrated languages.
        languageOfWiderCommunicationId: linkId(p.languageOfWiderCommunication),
        languageOfReportingId: linkId(p.languageOfReporting),
        startDate: dateStr(p.startDate),
        approvedPrograms: programs.kept,
        departmentIdBlockId: blockLanded ? blockId : null,
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
    if (droppedForOrganization) {
      ctx.log(
        `    ⚠ DROPPED ${droppedForOrganization} partner(s) whose organization never landed — organization_id is NOT NULL`,
      );
    }
    if (nulledContacts) {
      ctx.log(
        `    ⚠ nulled pointOfContact on ${nulledContacts} partner(s) whose contact user never landed`,
      );
    }
    if (nulledBlocks) {
      ctx.log(
        `    ⚠ nulled departmentIdBlock on ${nulledBlocks} partner(s) whose block never landed`,
      );
    }
    out.partners = stat(dtos.length, await bulkInsert(ctx, partners, rows));

    // Junction guards. The partner side is read back from Postgres rather than
    // reused from `rows`, so a partner dropped just above OR dropped by
    // onConflictDoNothing is caught here instead of failing the insert. The
    // far side of each junction is a NOT NULL FK, so a missing target drops the
    // junction row (there is nothing to null).
    const landedPartners = await liveTargetIds(ctx, 'Partner', partners);
    const landedRegions = await liveTargetIds(ctx, 'FieldRegion', fieldRegions);
    const landedLocations = await liveTargetIds(ctx, 'Location', locations);

    const frRows = keepLanded(
      dtos.flatMap((p) =>
        p.fieldRegions.flatMap((fr) => {
          const fieldRegionId = linkId(fr);
          return fieldRegionId ? [{ partnerId: p.id, fieldRegionId }] : [];
        }),
      ),
      [
        [landedPartners, (row) => row.partnerId],
        [landedRegions, (row) => row.fieldRegionId],
      ],
    );
    if (frRows.skipped) {
      ctx.log(
        `    ⚠ DROPPED ${frRows.skipped} partner_field_regions row(s) — partner or field region never landed`,
      );
    }
    out.partner_field_regions = stat(
      frRows.kept.length + frRows.skipped,
      await bulkInsert(ctx, partnerFieldRegions, frRows.kept),
    );

    const countryRows = keepLanded(
      dtos.flatMap((p) =>
        p.countries.flatMap((c) => {
          const locationId = linkId(c);
          return locationId ? [{ partnerId: p.id, locationId }] : [];
        }),
      ),
      [
        [landedPartners, (row) => row.partnerId],
        [landedLocations, (row) => row.locationId],
      ],
    );
    if (countryRows.skipped) {
      ctx.log(
        `    ⚠ DROPPED ${countryRows.skipped} partner_countries row(s) — partner or location never landed`,
      );
    }
    out.partner_countries = stat(
      countryRows.kept.length + countryRows.skipped,
      await bulkInsert(ctx, partnerCountries, countryRows.kept),
    );

    // `language_id` here is deliberately plain text with no FK (the docblock's
    // deferred-FK note), so only the partner side can be guarded.
    const locRows = keepLanded(
      dtos.flatMap((p) =>
        p.languagesOfConsulting.flatMap((l) => {
          const languageId = linkId(l);
          return languageId ? [{ partnerId: p.id, languageId }] : [];
        }),
      ),
      [[landedPartners, (row) => row.partnerId]],
    );
    if (locRows.skipped) {
      ctx.log(
        `    ⚠ DROPPED ${locRows.skipped} partner_languages_of_consulting row(s) whose partner never landed`,
      );
    }
    out.partner_languages_of_consulting = stat(
      locRows.kept.length + locRows.skipped,
      await bulkInsert(ctx, partnerLanguagesOfConsulting, locRows.kept),
    );

    return out;
  },
};

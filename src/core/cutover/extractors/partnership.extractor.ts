import {
  financialReportingTypeEnum,
  partners,
  partnershipAgreementStatusEnum,
  partnerships,
  partnerTypeEnum,
  projects,
} from '~/core/drizzle/schema';
import {
  type Partnership,
  type PartnershipAgreementStatus,
} from '../../../components/partnership/dto';
import { PartnershipRepository } from '../../../components/partnership/partnership.repository';
import {
  bulkInsert,
  dateStr,
  linkId,
  liveTargetIds,
  one,
  orDefault,
  readAllViaRepo,
  sanitizeEnum,
  tsReq,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Partnership. `mou_id`/`agreement_id` are deferred FKs (plain text) — the
 * Neo4j file IDs carry over now and become real references when the File wave
 * migrates `file_nodes` with the same IDs. mouStart/mouEnd (non-override) are
 * project-derived — not columns.
 */
export const partnershipExtractor: Extractor = {
  name: 'partnership',
  targetTables: ['partnerships'],
  dependsOn: ['project', 'partner'],
  async run(ctx) {
    const dtos = await readAllViaRepo<Partnership>(
      ctx,
      'Partnership',
      PartnershipRepository,
    );

    const agreementStatuses =
      partnershipAgreementStatusEnum.enumValues as readonly string[];
    const dropped = new Set<string>();
    const statusOr = (
      value: string | null | undefined,
    ): PartnershipAgreementStatus => {
      if (value && agreementStatuses.includes(value)) {
        // Runtime-validated against the pgEnum just above.
        return value as PartnershipAgreementStatus;
      }
      if (value) dropped.add(value);
      return 'NotAttached' as PartnershipAgreementStatus;
    };

    // Prod-finding #2 guard: both FKs are NOT NULL — drop dangling rows + log.
    const liveProjects = await liveTargetIds(ctx, 'Project', projects);
    const livePartners = await liveTargetIds(ctx, 'Partner', partners);
    let droppedDangling = 0;

    const rows = dtos.flatMap((p) => {
      const projectId = linkId(p.project);
      const partnerId = linkId(p.partner);
      if (
        !projectId ||
        !liveProjects.has(projectId) ||
        !partnerId ||
        !livePartners.has(partnerId)
      ) {
        droppedDangling++;
        return [];
      }
      const types = sanitizeEnum([...p.types], partnerTypeEnum.enumValues);
      types.dropped.forEach((value) => dropped.add(value));
      const frt =
        p.financialReportingType &&
        (financialReportingTypeEnum.enumValues as readonly string[]).includes(
          p.financialReportingType,
        )
          ? p.financialReportingType
          : null;
      if (p.financialReportingType && !frt) {
        dropped.add(p.financialReportingType);
      }
      return {
        id: p.id,
        projectId,
        partnerId,
        agreementStatus: statusOr(p.agreementStatus),
        mouStatus: statusOr(p.mouStatus),
        // Deferred FKs — File wave makes these real (IDs are preserved).
        mouId: linkId(p.mou),
        agreementId: linkId(p.agreement),
        mouStartOverride: dateStr(p.mouStartOverride),
        mouEndOverride: dateStr(p.mouEndOverride),
        types: types.kept,
        financialReportingType: frt,
        primary: orDefault(p.primary, false),
        createdAt: tsReq(p.createdAt),
        updatedAt: tsReq(p.createdAt),
        deletedAt: null,
      };
    });
    if (dropped.size) {
      ctx.log(
        `    ⚠ dropped unknown partnership enum value(s): ${[...dropped].join(', ')} — migration-todo: map, don't drop`,
      );
    }
    if (droppedDangling) {
      ctx.log(
        `    ⚠ dropped ${droppedDangling} partnership(s) with dangling project/partner refs (NOT NULL FKs — prod-finding #2)`,
      );
    }
    return one(
      'partnerships',
      dtos.length,
      await bulkInsert(ctx, partnerships, rows),
    );
  },
};

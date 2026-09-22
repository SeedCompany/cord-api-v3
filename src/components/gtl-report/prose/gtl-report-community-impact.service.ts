import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
import { type PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import {
  type GtlProseVariant,
  type GTLReport,
  type GtlReportCommunityImpact,
} from '../dto';
import { communityImpactPrompts } from './gtl-prompts';
import { GtlReportCommunityImpactDrizzleRepository } from './gtl-report-community-impact.drizzle.repository';

@Injectable()
export class GtlReportCommunityImpactService extends PromptVariantResponseListService(
  // migration-todo(cutover-cleanup): the service factory is typed against the
  // Neo4j repository base, and GTL is Postgres-only by decision, so there is no
  // Neo4j arm to pass. Cast to the factory's own parameter type rather than to
  // `any`: `any` erases TVariant, which collapses every downstream mutation
  // input to `never` and forces the callers to re-assert it. Type-only, so it
  // is erased at compile time.
  GtlReportCommunityImpactDrizzleRepository as unknown as ReturnType<
    typeof PromptVariantResponseRepository<
      typeof GTLReport,
      typeof GtlReportCommunityImpact,
      GtlProseVariant
    >
  >,
) {
  protected async getPrompts(): Promise<readonly Prompt[]> {
    return communityImpactPrompts;
  }

  protected async getPrivilegeContext(
    dto: UnsecuredDto<GtlReportCommunityImpact>,
  ) {
    const report = (await this.resources.loadByBaseNode(
      dto.parent,
    )) as GTLReport;
    return withEffectiveSensitivity(
      withScope({}, report.scope),
      report.sensitivity,
    );
  }
}

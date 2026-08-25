import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { withEffectiveSensitivity, withScope } from '../../authorization';
import { type Prompt } from '../../prompts/dto';
import { PromptVariantResponseListService } from '../../prompts/prompt-variant-response.service';
import { type GTLReport, type GtlReportCommunityImpact } from '../dto';
import { communityImpactPrompts } from './gtl-prompts';
import { GtlReportCommunityImpactDrizzleRepository } from './gtl-report-community-impact.drizzle.repository';

@Injectable()
export class GtlReportCommunityImpactService extends PromptVariantResponseListService(
  // migration-todo(cutover-cleanup): PromptVariantResponseListService is typed
  // against the Neo4j repository base, so a Drizzle-only repo needs this cast.
  // It erases the variant type, which is why the resolver re-asserts it.
  GtlReportCommunityImpactDrizzleRepository as any,
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

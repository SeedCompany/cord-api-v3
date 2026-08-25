import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Privileges } from '../../authorization';
import {
  ExplainGtlProgress as ExplainGtlProgressInput,
  GtlProgressExplanation,
  GTLReport,
} from '../dto';
import { GtlProgressExplanationRepository } from './gtl-progress-explanation.repository';

@Resolver(GTLReport)
export class GtlProgressExplanationResolver {
  constructor(
    private readonly repo: GtlProgressExplanationRepository,
    private readonly privileges: Privileges,
  ) {}

  @ResolveField(() => GtlProgressExplanation, {
    description:
      "The FPM's explanation of progress. Confidential — Field Operations only.",
  })
  async progressExplanation(
    @Parent() report: GTLReport,
  ): Promise<GtlProgressExplanation> {
    const row = await this.repo.readOne(report.id);
    const canRead = this.privileges.for(GTLReport, report as any).can('edit');
    const explanation: GtlProgressExplanation = {
      status: { value: row?.status, canRead, canEdit: canRead },
      context: { value: row?.context ?? null, canRead, canEdit: canRead },
    };
    return explanation;
  }

  @Mutation(() => GtlProgressExplanation)
  async explainGtlProgress(
    @Args('input') input: ExplainGtlProgressInput,
  ): Promise<GtlProgressExplanation> {
    const row = await this.repo.upsert(input);
    const explanation: GtlProgressExplanation = {
      status: { value: row.status, canRead: true, canEdit: true },
      context: { value: row.context, canRead: true, canEdit: true },
    };
    return explanation;
  }
}

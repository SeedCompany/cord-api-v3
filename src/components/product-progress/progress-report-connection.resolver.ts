import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { ProgressReport } from '../periodic-report/dto';
import { ProductProgress } from './dto';
import { ProductProgressService } from './product-progress.service';

@Resolver(ProgressReport)
export class ProgressReportConnectionResolver {
  constructor(private readonly service: ProductProgressService) {}

  @ResolveField(() => [ProductProgress], {
    description: 'Progress for all products in this report',
  })
  async progress(
    @Parent() report: ProgressReport,
    @AnonSession() session: Session
  ): Promise<readonly ProductProgress[]> {
    return await this.service.readAllByReport(report.id, session);
  }
}

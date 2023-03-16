import { ResolveField, Resolver } from '@nestjs/graphql';
import { ProgressReport } from '../progress-report/dto';
import { OutcomeHistory } from './dto';

@Resolver(ProgressReport)
export class OutcomeProgressReportConnectionResolver {
  @ResolveField(() => [OutcomeHistory], {
    description: 'List of outcomes belonging to an engagement',
  })
  async outcomes() {
    return [];
  }
}

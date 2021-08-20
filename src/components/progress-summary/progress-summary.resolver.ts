import { Float, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ProgressSummary } from './dto';

@Resolver(ProgressSummary)
export class ProgressSummaryResolver {
  @ResolveField(() => Float, {
    description: 'The difference between the actual and planned values',
  })
  variance(@Parent() summary: ProgressSummary): number {
    return summary.actual - summary.planned;
  }
}

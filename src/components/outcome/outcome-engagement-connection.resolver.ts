import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LanguageEngagement } from '../engagement/dto';
import { OutcomeList } from './dto/list-outcome.dto';
import { OutcomesService } from './outomes.service';

@Resolver(LanguageEngagement)
export class OutcomeEngagementConnectionResolver {
  constructor(private readonly service: OutcomesService) {}

  @ResolveField(() => OutcomeList, {
    description: 'List of outcomes belonging to an engagement',
  })
  async outcomes(@Parent() engagement: LanguageEngagement) {
    return await this.service.listByEngagementId(engagement.id);
  }
}

import { ResolveField, Resolver } from '@nestjs/graphql';
import { LanguageEngagement } from '../engagement/dto';
import { OutcomeList } from './dto/list-outcome.dto';

@Resolver(LanguageEngagement)
export class OutcomeEngagementConnectionResolver {
  @ResolveField(() => OutcomeList, {
    description: 'List of outcomes belonging to an engagement',
  })
  async outcomes(): Promise<OutcomeList> {
    return {
      items: [],
      hasMore: false,
      total: 0,
    };
  }
}

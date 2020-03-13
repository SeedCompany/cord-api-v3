import { NotImplementedException } from '@nestjs/common';
import { Args, Parent, ResolveProperty, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../auth';
import { LanguageEngagement } from './dto';

@Resolver(LanguageEngagement.classType)
export class LanguageEngagementResolver {
  @ResolveProperty(() => Boolean)
  async products(
    @Parent() _engagement: LanguageEngagement,
    @Session() _session: ISession,
    @Args({
      name: 'input',
      type: () => Boolean,
    })
    _input: unknown
  ): Promise<unknown> {
    throw new NotImplementedException();
  }
}

import { Args, Parent, ResolveProperty, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { ProductListInput, SecuredProductList } from '../product/dto';
import { LanguageEngagement } from './dto';
import { EngagementService } from './engagement.service';

@Resolver(LanguageEngagement.classType)
export class LanguageEngagementResolver {
  constructor(private readonly engagements: EngagementService) {}

  @ResolveProperty(() => SecuredProductList)
  async products(
    @Parent() engagement: LanguageEngagement,
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => ProductListInput,
      nullable: true,
    })
    input?: ProductListInput
  ): Promise<SecuredProductList> {
    return this.engagements.listProducts(
      engagement,
      input || ProductListInput.defaultVal,
      session
    );
  }
}

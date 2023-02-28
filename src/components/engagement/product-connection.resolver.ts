import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Fields, IsOnlyId } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { Product } from '../product';
import { LanguageEngagement } from './dto';
import { EngagementLoader } from './engagement.loader';

@Resolver(Product)
export class EngagementProductConnectionResolver {
  @ResolveField(() => LanguageEngagement)
  async engagement(
    @Parent() product: Product,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    @Info(Fields, IsOnlyId) onlyId: boolean,
  ) {
    return onlyId
      ? { id: product.engagement }
      : await engagements.load({
          id: product.engagement,
          view: { active: true },
        });
  }
}

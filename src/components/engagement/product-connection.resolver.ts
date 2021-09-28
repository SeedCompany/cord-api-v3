import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '../../core';
import { Product } from '../product';
import { LanguageEngagement } from './dto';
import { EngagementLoader } from './engagement.loader';

@Resolver(Product)
export class EngagementProductConnectionResolver {
  @ResolveField(() => LanguageEngagement)
  async engagement(
    @Parent() product: Product,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>
  ) {
    return await engagements.load({
      id: product.engagement,
      view: { active: true },
    });
  }
}

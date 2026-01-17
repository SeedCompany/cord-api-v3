import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Variant } from '~/common';
import { Identity } from '~/core/authentication';
import { ProductCreated } from '../product/dto';
import { ProductProgressService } from './product-progress.service';

@Resolver(() => ProductCreated)
export class ProgressReportCreateProductConnectionResolver {
  constructor(
    private readonly service: ProductProgressService,
    private readonly identity: Identity,
  ) {}

  @ResolveField(() => [Variant], {
    description: 'All available progress variants for this product',
  })
  async availableVariants(
    @Parent() { product }: ProductCreated,
  ): Promise<readonly Variant[]> {
    // TODO move to auth policy
    if (this.identity.isAnonymous) {
      return [];
    }
    return await this.service.getAvailableVariantsForProduct(product);
  }
}

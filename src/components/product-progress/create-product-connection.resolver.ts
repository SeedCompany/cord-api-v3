import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { LoggedInSession, Session, Variant } from '~/common';
import { CreateProductOutput } from '../product';
import { ProductProgressService } from './product-progress.service';

@Resolver(() => CreateProductOutput)
export class ProgressReportCreateProductConnectionResolver {
  constructor(private readonly service: ProductProgressService) {}

  @ResolveField(() => [Variant], {
    description: 'All available progress variants for this product',
  })
  async availableVariants(
    @Parent() { product }: CreateProductOutput,
    @LoggedInSession() session: Session
  ): Promise<readonly Variant[]> {
    return await this.service.getAvailableVariantsForProduct(product, session);
  }
}

import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, type Session, Variant } from '~/common';
import { CreateProductOutput } from '../product/dto';
import { ProductProgressService } from './product-progress.service';

@Resolver(() => CreateProductOutput)
export class ProgressReportCreateProductConnectionResolver {
  constructor(private readonly service: ProductProgressService) {}

  @ResolveField(() => [Variant], {
    description: 'All available progress variants for this product',
  })
  async availableVariants(
    @Parent() { product }: CreateProductOutput,
    @AnonSession() session: Session,
  ): Promise<readonly Variant[]> {
    // TODO move to auth policy
    if (session.anonymous) {
      return [];
    }
    return await this.service.getAvailableVariantsForProduct(product, session);
  }
}

import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { Product } from '../product/dto';
import { ProductProgress, VariantProgressArg } from './dto';
import { ProductProgressByProductLoader } from './product-progress-by-product.loader';
import { ProductProgressService } from './product-progress.service';

@Resolver(Product)
export class ProductConnectionResolver {
  constructor(private readonly service: ProductProgressService) {}

  @ResolveField(() => [ProductProgress], {
    description: 'Progress for all reports of this product',
  })
  async progressReports(
    @Parent() product: Product,
    @Args() { variant }: VariantProgressArg,
    @Loader(ProductProgressByProductLoader)
    loader: LoaderOf<ProductProgressByProductLoader>,
  ): Promise<readonly ProductProgress[]> {
    return (await loader.load({ product, variant })).details;
  }

  @ResolveField(() => ProductProgress, {
    description: 'The progress of this product from a specific report',
  })
  async progressReport(
    @IdArg({ name: 'reportId' }) reportId: ID,
    @Parent() product: Product,
    @Args() { variant }: VariantProgressArg,
  ): Promise<ProductProgress> {
    return await this.service.readOne(reportId, product, variant);
  }

  @ResolveField(() => ProductProgress, {
    nullable: true,
    description: 'The progress of this product for the report currently due',
  })
  async progressOfCurrentReportDue(
    @Parent() product: Product,
    @Args() { variant }: VariantProgressArg,
  ): Promise<ProductProgress | undefined> {
    return await this.service.readOneForCurrentReport({ product, variant });
  }
}

import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { LoggedInSession, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { PeriodicReportLoader } from '../periodic-report';
import { ProductLoader } from '../product';
import { Product } from '../product/dto';
import { ProgressReport } from '../progress-report/dto';
import { ProductProgress, ProductProgressInput } from './dto';
import { ProductProgressService } from './product-progress.service';

@Resolver(ProductProgress)
export class ProductProgressResolver {
  constructor(private readonly service: ProductProgressService) {}

  @ResolveField(() => Product)
  async product(
    @Parent() { productId }: ProductProgress,
    @Loader(ProductLoader) products: LoaderOf<ProductLoader>,
  ): Promise<Product> {
    return await products.load(productId);
  }

  @ResolveField(() => ProgressReport)
  async report(
    @Parent() { reportId }: ProductProgress,
    @Loader(PeriodicReportLoader)
    periodicReports: LoaderOf<PeriodicReportLoader>,
  ) {
    return await periodicReports.load(reportId);
  }

  @Mutation(() => ProductProgress)
  async updateProductProgress(
    @Args('input') input: ProductProgressInput,
    @LoggedInSession() session: Session,
  ): Promise<ProductProgress> {
    return await this.service.update(input, session);
  }
}

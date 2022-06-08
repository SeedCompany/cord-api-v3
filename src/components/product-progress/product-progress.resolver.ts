import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { PeriodicReportLoader, ProgressReport } from '../periodic-report';
import { Product, ProductLoader } from '../product';
import { ProductProgress, ProductProgressInput } from './dto';
import { ProductProgressService } from './product-progress.service';

@Resolver(ProductProgress)
export class ProductProgressResolver {
  constructor(private readonly service: ProductProgressService) {}

  @ResolveField(() => Product)
  async product(
    @Parent() { productId }: ProductProgress,
    @Loader(ProductLoader) products: LoaderOf<ProductLoader>
  ): Promise<Product> {
    // since ProductProgress isn't changeset aware, we're passing a view in of active: true
    // until later. Fix the parameters and view once ProductProgess is made changesetAware
    return await products.load({ id: productId, view: { active: true } });
  }

  @ResolveField(() => ProgressReport)
  async report(
    @Parent() { reportId }: ProductProgress,
    @Loader(PeriodicReportLoader)
    periodicReports: LoaderOf<PeriodicReportLoader>
  ) {
    return await periodicReports.load(reportId);
  }

  @Mutation(() => ProductProgress)
  async updateProductProgress(
    @Args('input') input: ProductProgressInput,
    @LoggedInSession() session: Session
  ): Promise<ProductProgress> {
    return await this.service.update(input, session);
  }
}

import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, LoggedInSession, Session } from '../../common';
import { PeriodicReportService, ProgressReport } from '../periodic-report';
import { Product, ProductService } from '../product';
import { ProductProgress, ProductProgressInput } from './dto';
import { ProductProgressService } from './product-progress.service';

@Resolver(ProductProgress)
export class ProductProgressResolver {
  constructor(
    private readonly products: ProductService,
    private readonly reports: PeriodicReportService,
    private readonly service: ProductProgressService
  ) {}

  @ResolveField(() => Product)
  async product(
    @Parent() { productId }: ProductProgress,
    @AnonSession() session: Session
  ): Promise<Product> {
    return await this.products.readOne(productId, session);
  }

  @ResolveField(() => ProgressReport)
  async report(
    @Parent() { reportId }: ProductProgress,
    @AnonSession() session: Session
  ) {
    return await this.reports.readOne(reportId, session);
  }

  @Mutation(() => ProductProgress)
  async updateProductProgress(
    @Args('input') input: ProductProgressInput,
    @LoggedInSession() session: Session
  ): Promise<ProductProgress> {
    return await this.service.update(input, session);
  }
}

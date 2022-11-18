import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '../../core';
import { ProgressReport } from '../progress-report/dto';
import { ProductProgress, VariantProgressArg } from './dto';
import { ProductProgressByReportLoader } from './product-progress-by-report.loader';

@Resolver(() => ProgressReport)
export class ProgressReportConnectionResolver {
  @ResolveField(() => [ProductProgress], {
    description: 'Progress for all products in this report',
  })
  async progress(
    @Parent() report: ProgressReport,
    @Args() { variant }: VariantProgressArg,
    @Loader(ProductProgressByReportLoader)
    loader: LoaderOf<ProductProgressByReportLoader>
  ): Promise<readonly ProductProgress[]> {
    return (await loader.load({ report, variant })).details;
  }
}

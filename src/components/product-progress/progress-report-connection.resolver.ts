import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { sortBy } from 'lodash';
import { ClientException } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { ProgressReport } from '../progress-report/dto';
import {
  ProductProgress,
  ProgressReportVariantProgress as Progress,
  VariantProgressArg,
} from './dto';
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
    loader: LoaderOf<ProductProgressByReportLoader>,
  ): Promise<readonly ProductProgress[]> {
    return (await loader.load({ report, variant })).details;
  }

  @ResolveField(() => [[ProductProgress]])
  async progressForAllVariants(
    @Parent() report: ProgressReport,
    @Loader(ProductProgressByReportLoader)
    loader: LoaderOf<ProductProgressByReportLoader>,
  ): Promise<ReadonlyArray<readonly ProductProgress[]>> {
    const detailsOrErrors = await loader.loadMany(
      Progress.Variants.map((variant) => ({ report, variant })),
    );
    const details = detailsOrErrors.flatMap((entry) => {
      if (entry instanceof Error) {
        if (entry instanceof ClientException) {
          return [];
        }
        throw entry;
      }
      if (entry.details.length === 0) {
        return [];
      }
      return [entry.details];
    });
    const orderMap = Object.fromEntries(
      Progress.Variants.map((variant, index) => [variant.key, index]),
    );
    return sortBy(details, (detail) => orderMap[detail[0].variant.key]);
  }
}

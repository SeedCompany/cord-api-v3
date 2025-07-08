import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { asNonEmptyArray, sortBy } from '@seedcompany/common';
import { loadManyIgnoreMissingThrowAny } from '~/common';
import { Loader, type LoaderOf } from '~/core';
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
    const detailsOrErrors = await loadManyIgnoreMissingThrowAny(
      loader,
      Progress.Variants.map((variant) => ({ report, variant })),
    );
    const details = detailsOrErrors.flatMap((entry) => {
      const detail = asNonEmptyArray(entry.details);
      return detail ? [detail] : [];
    });
    const orderMap = Object.fromEntries(
      Progress.Variants.map((variant, index) => [variant.key, index]),
    );
    return sortBy(details, (detail) => orderMap[detail[0].variant.key]);
  }
}

import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  ID,
  mapSecuredValue,
  SecuredFloatNullable,
  simpleSwitch,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { ProductLoader } from '../product';
import { ProgressFormat, StepProgress } from './dto';

@Resolver(StepProgress)
export class StepProgressResolver {
  @ResolveField(() => SecuredFloatNullable)
  async completed(
    @Parent() sp: StepProgress & { productId: ID },
    @Loader(() => ProductLoader) products: LoaderOf<ProductLoader>,
    @Args('format', {
      type: () => ProgressFormat,
      defaultValue: ProgressFormat.Numerator,
      description: stripIndent`
        The format the progress value will be returned in

        Some formats are not supported for all products, like verses in other products,
        in these cases a null \`value\` is returned.
      `,
    })
    format: ProgressFormat,
  ): Promise<SecuredFloatNullable> {
    const product = await products.load(sp.productId);
    if (
      !product.progressTarget.canRead ||
      // progress target should always be >0 so this is just a sanity check
      !product.progressTarget.value
    ) {
      return { canRead: false, canEdit: false };
    }
    const denominator = product.progressTarget.value;
    const factor = simpleSwitch(format, {
      [ProgressFormat.Numerator]: denominator,
      [ProgressFormat.Decimal]: 1,
      [ProgressFormat.Percent]: 100,
      [ProgressFormat.Verses]: product.totalVerses,
      [ProgressFormat.VerseEquivalents]: product.totalVerseEquivalents,
    });
    return await mapSecuredValue(sp.completed, async (val) =>
      factor != null ? (val / denominator) * factor : null,
    );
  }
}

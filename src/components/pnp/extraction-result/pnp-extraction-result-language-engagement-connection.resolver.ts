import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '@seedcompany/data-loader';
import { LanguageEngagement } from '../../engagement/dto';
import { PnpPlanningExtractionResult } from './extraction-result.dto';
import { PnpExtractionResultLoader } from './pnp-extraction-result.loader';

@Resolver(LanguageEngagement)
export class PnpExtractionResultLanguageEngagementConnectionResolver {
  @ResolveField(() => PnpPlanningExtractionResult, {
    nullable: true,
  })
  async pnpExtractionResult(
    @Parent() engagement: LanguageEngagement,
    @Loader(() => PnpExtractionResultLoader)
    loader: LoaderOf<PnpExtractionResultLoader>,
  ): Promise<PnpPlanningExtractionResult | null> {
    const file = engagement.pnp.value;
    if (!file) {
      return null;
    }
    const { result } = await loader.load(file.id);
    return result;
  }
}

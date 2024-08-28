import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, LoaderOf } from '@seedcompany/data-loader';
import { ProgressReport } from '../../progress-report/dto';
import { PnpProgressExtractionResult } from './extraction-result.dto';
import { PnpExtractionResultLoader } from './pnp-extraction-result.loader';

@Resolver(ProgressReport)
export class PnpExtractionResultProgressReportConnectionResolver {
  @ResolveField(() => PnpProgressExtractionResult, {
    nullable: true,
  })
  async pnpExtractionResult(
    @Parent() report: ProgressReport,
    @Loader(() => PnpExtractionResultLoader)
    loader: LoaderOf<PnpExtractionResultLoader>,
  ): Promise<PnpProgressExtractionResult | null> {
    const fileId = report.reportFile.value;
    if (!fileId) {
      return null;
    }
    const { result } = await loader.load(fileId);
    return result;
  }
}

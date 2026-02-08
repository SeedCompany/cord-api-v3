import { Mutation, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, InputException } from '~/common';
import { Hooks, Loader, type LoaderOf } from '~/core';
import { FileNodeLoader, FileService, resolveDefinedFile } from '../../file';
import { PeriodicReportLoader } from '../../periodic-report';
import { PeriodicReportUploadedHook } from '../../periodic-report/hooks';
import { PnpProgressExtractionResult } from '../../pnp/extraction-result';

@Resolver()
export class ReextractPnpResolver {
  constructor(
    private readonly files: FileService,
    private readonly hooks: Hooks,
  ) {}

  @Mutation(() => PnpProgressExtractionResult)
  async reextractPnpProgress(
    @IdArg({
      name: 'report',
      description: 'An ID of a ProgressReport that has a reportFile uploaded',
    })
    reportId: ID<'ProgressReport'>,
    @Loader(PeriodicReportLoader) reportLoader: LoaderOf<PeriodicReportLoader>,
    @Loader(FileNodeLoader) fileLoader: LoaderOf<FileNodeLoader>,
  ): Promise<PnpProgressExtractionResult> {
    const report = await reportLoader.load(reportId);
    if (report.type !== 'Progress') {
      throw new InputException(
        "Only ProgressReports can have PnP's re-extracted",
      );
    }
    const file = await resolveDefinedFile(fileLoader, report.reportFile);
    if (!file.value) {
      throw new InputException('This report does not have a PnP uploaded');
    }

    const fv = await this.files.getFileVersion(file.value.latestVersionId);
    const pnp = this.files.asDownloadable(fv);

    const event = new PeriodicReportUploadedHook(report, pnp);
    await this.hooks.run(event);

    return event.pnpResult;
  }
}

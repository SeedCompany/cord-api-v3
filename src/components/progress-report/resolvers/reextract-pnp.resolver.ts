import { Mutation, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, InputException } from '~/common';
import { IEventBus, Loader, type LoaderOf } from '~/core';
import { FileNodeLoader, FileService, resolveDefinedFile } from '../../file';
import { PeriodicReportLoader } from '../../periodic-report';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { PnpProgressExtractionResult } from '../../pnp/extraction-result';

@Resolver()
export class ReextractPnpResolver {
  constructor(
    private readonly files: FileService,
    private readonly eventBus: IEventBus,
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

    const event = new PeriodicReportUploadedEvent(report, pnp);
    await this.eventBus.publish(event);

    return event.pnpResult;
  }
}

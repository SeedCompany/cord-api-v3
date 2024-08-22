import { Mutation, Resolver } from '@nestjs/graphql';
import { ID, IdArg, InputException, LoggedInSession, Session } from '~/common';
import { IEventBus, Loader, LoaderOf } from '~/core';
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
      name: 'reportId',
      description: 'An ID of a ProgressReport that has a reportFile uploaded',
    })
    reportId: ID,
    @Loader(PeriodicReportLoader) reportLoader: LoaderOf<PeriodicReportLoader>,
    @Loader(FileNodeLoader) fileLoader: LoaderOf<FileNodeLoader>,
    @LoggedInSession() session: Session,
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

    const fv = await this.files.getFileVersion(
      file.value.latestVersionId,
      session,
    );
    const pnp = this.files.asDownloadable(fv);

    const event = new PeriodicReportUploadedEvent(report, pnp, session);
    await this.eventBus.publish(event);

    return event.pnpResult;
  }
}

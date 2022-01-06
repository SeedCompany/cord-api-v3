import { EventsHandler, ILogger, Logger } from '../../../core';
import { ReportType } from '../../periodic-report/dto';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { ProductService } from '../../product';
import { ProductProgressService } from '../product-progress.service';
import { StepProgressExtractor } from '../step-progress-extractor.service';

@EventsHandler(PeriodicReportUploadedEvent)
export class ExtractPnpProgressHandler {
  constructor(
    private readonly extractor: StepProgressExtractor,
    private readonly progress: ProductProgressService,
    private readonly products: ProductService,
    @Logger('step-progress:extractor') private readonly logger: ILogger
  ) {}

  async handle(event: PeriodicReportUploadedEvent) {
    if (event.report.type !== ReportType.Progress) {
      return;
    }

    // parse progress data from pnp spreadsheet
    let progressRows;
    try {
      progressRows = await this.extractor.extract(event.file);
    } catch (e) {
      this.logger.warning(e.message, {
        name: event.file.name,
        id: event.file.id,
        exception: e,
      });
      return;
    }
    if (progressRows.length === 0) {
      return;
    }

    // Fetch products for report mapped to a book/story name
    const engagementId = event.report.parent.properties.id;
    const productIds = await this.products.loadProductIdsByPnpIndex(
      engagementId
    );

    // Convert row to product ID
    const updates = progressRows.flatMap((row) => {
      const { steps, ...rest } = row;
      const productId = productIds[row.rowIndex];
      if (productId) {
        return { productId, steps };
      }

      this.logger.warning('Could not find product in pnp', {
        ...rest,
        report: event.report.id,
        file: event.file.id,
      });
      return [];
    });

    // Update progress for report & product
    await Promise.all(
      updates.map(async (input) => {
        await this.progress.update(
          {
            ...input,
            reportId: event.report.id,
          },
          event.session
        );
      })
    );
  }
}

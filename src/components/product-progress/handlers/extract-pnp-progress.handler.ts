import { EventsHandler, ILogger, Logger } from '../../../core';
import { FileService } from '../../file';
import { ReportType } from '../../periodic-report/dto';
import { PnpProgressUploadedEvent } from '../../periodic-report/events';
import { ProducibleType, ProductService } from '../../product';
import { ProductProgressService } from '../product-progress.service';
import { StepProgressExtractor } from '../step-progress-extractor.service';

@EventsHandler(PnpProgressUploadedEvent)
export class ExtractPnpProgressHandler {
  constructor(
    private readonly extractor: StepProgressExtractor,
    private readonly progress: ProductProgressService,
    private readonly products: ProductService,
    private readonly files: FileService,
    @Logger('step-progress:extractor') private readonly logger: ILogger
  ) {}

  async handle(event: PnpProgressUploadedEvent) {
    if (event.report.type !== ReportType.Progress) {
      return;
    }

    // parse progress data from pnp spreadsheet
    let progressRows;
    try {
      progressRows = await this.extractor.extract(
        this.files.asDownloadable(event.file)
      );
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
    const storyProducts = progressRows[0].story
      ? await this.products.loadProductIdsWithProducibleNames(
          engagementId,
          ProducibleType.Story
        )
      : {};
    const scriptureProducts = progressRows[0].bookName
      ? await this.products.loadProductIdsForBookAndVerse(
          engagementId,
          this.logger
        )
      : [];

    // Convert row to product ID
    const updates = progressRows.flatMap((row) => {
      const { steps, ...rest } = row;
      const productId = row.bookName
        ? scriptureProducts.find(
            (ref) =>
              ref.book === row.bookName && ref.totalVerses === row.totalVerses
          )?.id
        : storyProducts[row.story!];
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

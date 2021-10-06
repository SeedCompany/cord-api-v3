import { uniq } from 'lodash';
import { ID } from '../../../common';
import { EventsHandler, ILogger, Logger } from '../../../core';
import { ReportType } from '../../periodic-report/dto';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { ProductService } from '../../product';
import { ScriptureRange } from '../../scripture';
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
    const progressRows = await this.extractor.extract(event.file);
    if (progressRows.length === 0) {
      return;
    }

    // Fetch products for report mapped to a book name
    const bookMap = await this.getProductsMappedToBook(event);

    // Convert book name to product ID
    const updates = progressRows.flatMap(({ bookName, steps }) => {
      const productId = bookMap[bookName];
      if (productId) {
        return { productId, steps };
      }

      this.logger.warning('Could not find product for book in pnp', {
        bookName,
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

  private async getProductsMappedToBook(
    event: PeriodicReportUploadedEvent
  ): Promise<Record<string, ID>> {
    const productRefs = await this.products.listIdsAndScriptureRefs(
      event.report.parent.properties.id
    );
    return productRefs.reduce((booksSoFar: Record<string, ID>, productRef) => {
      const refs = productRef.scriptureRanges.map((raw) =>
        ScriptureRange.fromIds(raw.properties)
      );
      const bookEnds = uniq(
        refs.flatMap((ref) => [ref.start.book, ref.end.book])
      );

      const warn = (msg: string) =>
        this.logger.warning(
          `${msg} and is therefore ignored from pnp progress extraction`,
          { product: productRef.id }
        );

      if (bookEnds.length === 0) {
        warn('Product has not defined any scripture ranges');
        return booksSoFar;
      }
      if (bookEnds.length > 1) {
        warn('Product scripture range spans multiple books');
        return booksSoFar;
      }
      const book = bookEnds[0];

      if (book in booksSoFar) {
        warn(
          'Product references a book that has already been assigned to another product'
        );
        return booksSoFar;
      }

      booksSoFar[book] = productRef.id;
      return booksSoFar;
    }, {});
  }
}

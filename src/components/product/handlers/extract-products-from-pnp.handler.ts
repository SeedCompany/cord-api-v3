import { has } from 'lodash';
import { DateTime } from 'luxon';
import { asyncPool } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import {
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
} from '../../engagement/events';
import { FileService } from '../../file';
import { ScriptureRangeInput } from '../../scripture';
import { Book } from '../../scripture/books';
import {
  CreateDirectScriptureProduct,
  getAvailableSteps,
  ProducibleType,
  ProgressMeasurement,
} from '../dto';
import { ProductExtractor } from '../product-extractor.service';
import { ProductService } from '../product.service';

type SubscribedEvent = EngagementCreatedEvent | EngagementUpdatedEvent;

@EventsHandler(EngagementCreatedEvent, EngagementUpdatedEvent)
export class ExtractProductsFromPnpHandler
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly products: ProductService,
    private readonly files: FileService,
    private readonly extractor: ProductExtractor,
    @Logger('product:extractor') private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent): Promise<void> {
    if (!event.isLanguageEngagement()) {
      return;
    }
    const engagement =
      event instanceof EngagementCreatedEvent
        ? event.engagement
        : event.updated;
    const pnpFileId =
      event instanceof EngagementCreatedEvent
        ? event.input.pnp?.uploadId
        : event.updates.pnp?.uploadId;
    const methodology =
      event instanceof EngagementCreatedEvent
        ? event.input.methodology
        : event.updates.methodology;
    if (!pnpFileId || !methodology) {
      return;
    }

    const file = this.files.asDownloadable({ id: pnpFileId }, pnpFileId);

    const availableSteps = getAvailableSteps({
      methodology,
      type: ProducibleType.DirectScriptureProduct,
    });
    const productRows = await this.extractor.extract(file, availableSteps);
    if (productRows.length === 0) {
      return;
    }

    // Given that we have products to potentially create, load the existing ones
    // and map them to a book and total verse count.
    const products = await this.products.loadProductIdsForBookAndVerse(
      engagement.id,
      this.logger
    );

    // Filter out existing products, and convert new ones to create product input.
    const createdAt = DateTime.now();
    const productsToCreate = productRows.flatMap(
      ({ bookName, totalVerses, steps, note }, index) => {
        if (has(products, [bookName, totalVerses])) {
          this.logger.debug('Product already exists, skipping', {
            bookName,
            totalVerses,
            engagement: engagement.id,
          });
          return [];
        }

        // Populate one of the two product props based on whether its a known verse range or not.
        const book = Book.find(bookName);
        const isKnown = book.totalVerses === totalVerses;
        const scriptureReferences: ScriptureRangeInput[] = isKnown
          ? [
              {
                start: book.firstChapter.firstVerse.reference,
                end: book.lastChapter.lastVerse.reference,
              },
            ]
          : [];
        const unspecifiedScripture = isKnown
          ? undefined
          : { book: bookName, totalVerses };

        return {
          scriptureReferences,
          unspecifiedScripture,
          steps,
          describeCompletion: note,
          // Attempt to order products in the same order as specified in the PnP
          // The default sort prop is createdAt.
          // This doesn't account for row changes in subsequent PnP uploads
          createdAt: createdAt.plus({ milliseconds: index }),
        };
      }
    );

    // Create products 5 at a time.
    await asyncPool(5, productsToCreate, async (input) => {
      const create: CreateDirectScriptureProduct = {
        engagementId: engagement.id,
        progressStepMeasurement: ProgressMeasurement.Percent,
        methodology,
        ...input,
      };
      await this.products.create(create, event.session);
    });
  }
}

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
  UpdateDirectScriptureProduct,
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

    // Determine which product rows correspond to an existing product
    // or if they should create a new one or if they should be skipped.
    const actionableProductRows = productRows.flatMap((row, index, rows) => {
      const { bookName, totalVerses } = row;

      // Exact match
      const existingId = products[bookName]?.[totalVerses];
      if (existingId) {
        return { ...row, index, existingId };
      }

      if (rows.filter((other) => other.bookName === bookName).length === 1) {
        const existingProductsOfBook = products[bookName] ?? {};
        const numOfExistingProductsOfBook = Object.keys(
          existingProductsOfBook
        ).length;
        if (numOfExistingProductsOfBook === 1) {
          // If pnp has one of these books and we have one existing product of
          // this book then treat as an update with a total verses change.
          const existingId =
            existingProductsOfBook[Object.keys(existingProductsOfBook)[0]];
          return { ...row, index, existingId };
        } else if (numOfExistingProductsOfBook === 0) {
          // If pnp has one of these books and we have no existing product of
          // this book then treat as a new product.
          return { ...row, index, existingId: undefined };
        }
      }

      return []; // skip
    });

    const createdAt = DateTime.now();

    // Create/update products 5 at a time.
    await asyncPool(5, actionableProductRows, async (row) => {
      const { existingId, bookName, totalVerses, steps, note, index } = row;

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
        ? null
        : { book: bookName, totalVerses };

      const props = {
        methodology,
        scriptureReferences,
        unspecifiedScripture,
        steps,
        describeCompletion: note,
      };
      if (existingId) {
        const updates: UpdateDirectScriptureProduct = {
          id: existingId,
          ...props,
        };
        await this.products.updateDirect(updates, event.session);
      } else {
        const create: CreateDirectScriptureProduct = {
          engagementId: engagement.id,
          progressStepMeasurement: ProgressMeasurement.Percent,
          ...props,
          // Attempt to order products in the same order as specified in the PnP
          // The default sort prop is createdAt.
          // This doesn't account for row changes in subsequent PnP uploads
          createdAt: createdAt.plus({ milliseconds: index }),
        };
        await this.products.create(create, event.session);
      }
    });
  }
}

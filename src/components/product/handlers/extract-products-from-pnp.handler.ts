import { groupBy } from 'lodash';
import { DateTime } from 'luxon';
import { asyncPool, ID } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { Engagement } from '../../engagement';
import {
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
} from '../../engagement/events';
import { FileService } from '../../file';
import { ScriptureRangeInput } from '../../scripture';
import { Book } from '../../scripture/books';
import {
  CreateDerivativeScriptureProduct,
  CreateDirectScriptureProduct,
  getAvailableSteps,
  ProgressMeasurement,
  UpdateDerivativeScriptureProduct,
  UpdateDirectScriptureProduct,
} from '../dto';
import { ExtractedRow, ProductExtractor } from '../product-extractor.service';
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
    });
    const productRows = await this.extractor.extract(file, availableSteps);
    if (productRows.length === 0) {
      return;
    }

    if (productRows[0].story) {
      const actionableStoryRows = await this.matchRowsToStoryChanges(
        engagement,
        productRows
      );

      const createdAt = DateTime.now();

      await asyncPool(5, actionableStoryRows, async (row) => {
        const {
          existingId,
          index,
          steps,
          note,
          scripture,
          composite,
          producibleId,
        } = row;

        const props = {
          methodology,
          steps,
          scriptureReferencesOverride: scripture,
          describeCompletion: note,
        };

        if (existingId) {
          const updates: UpdateDerivativeScriptureProduct = {
            ...props,
            id: existingId,
          };
          await this.products.updateDerivative(updates, event.session);
        } else {
          const create: CreateDerivativeScriptureProduct = {
            ...props,
            engagementId: engagement.id,
            progressStepMeasurement: ProgressMeasurement.Percent,
            composite: !!composite,
            produces: producibleId!,
            scriptureReferencesOverride: scripture,
            createdAt: createdAt.plus({ milliseconds: index }),
          };
          await this.products.create(create, event.session);
        }
      });
    } else {
      const actionableProductRows = await this.matchRowsToProductChanges(
        engagement,
        productRows
      );

      const createdAt = DateTime.now();

      // Create/update products 5 at a time.
      await asyncPool(5, actionableProductRows, async (row) => {
        const { existingId, bookName, totalVerses, steps, note, index } = row;

        // Populate one of the two product props based on whether its a known verse range or not.
        const book = Book.find(bookName!);
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
          // @ts-expect-error skipping this validation for now
          const updates: UpdateDirectScriptureProduct = {
            id: existingId,
            ...props,
          };
          await this.products.updateDirect(updates, event.session);
        } else {
          // @ts-expect-error skipping this validation for now
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

  /**
   * Determine which product rows correspond to an existing product
   * or if they should create a new one or if they should be skipped.
   */
  private async matchRowsToProductChanges(
    engagement: Engagement,
    rows: readonly ExtractedRow[]
  ) {
    // Given that we have products to potentially create, load the existing ones
    // and map them to a book and total verse count.
    const scriptureProducts = rows[0].bookName
      ? await this.products.loadProductIdsForBookAndVerse(
          engagement.id,
          this.logger
        )
      : {};

    if (!rows[0].bookName) {
      return []; // skip until implemented
    }

    const actionableProductRows = Object.values(
      groupBy(
        rows.map((row, index) => ({ ...row, index })), // save original indexes
        (row) => row.bookName // group by book name
      )
    ).flatMap((rowsOfBook) => {
      const bookName = rowsOfBook[0].bookName;
      const existing = scriptureProducts[bookName!] ?? new Map<number, ID>();

      const matches: Array<
        ExtractedRow & { index: number; existingId: ID | undefined }
      > = [];
      let nonExactMatches: Array<ExtractedRow & { index: number }> = [];

      // Exact matches
      for (const row of rowsOfBook) {
        const { totalVerses } = row;
        const existingId = existing.get(totalVerses!);
        if (existingId) {
          matches.push({ ...row, existingId });
          existing.delete(totalVerses!);
        } else {
          nonExactMatches.push(row);
        }
      }

      // If there's only one product left for this book that hasn't been matched
      // And there's only one row left that can't be matched to a book & verse count
      if (existing.size === 1 && nonExactMatches.length === 1) {
        // Assume that ID belongs to this row.
        // Use case: A single row changes total verse count while other rows
        // for this book remain the same or are new.
        const oldVerseCount = [...existing.keys()][0];
        matches.push({
          ...nonExactMatches[0],
          existingId: existing.get(oldVerseCount)!,
        });
        existing.delete(oldVerseCount);
        nonExactMatches = [];
      }

      if (existing.size === 0) {
        // All remaining are new
        return [
          ...matches,
          ...nonExactMatches.map((row) => ({ ...row, existingId: undefined })),
        ];
      }

      // Not sure how to handle remaining so doing nothing with them

      return matches;
    });
    return actionableProductRows;
  }

  private async matchRowsToStoryChanges(
    engagement: Engagement,
    rows: readonly ExtractedRow[]
  ) {
    const storyProducts = rows[0].story
      ? await this.products.loadProductIdsForStories(engagement.id, this.logger)
      : {};

    if (!rows[0].story) {
      return [];
    }

    const actionableStoryRows = Object.values(
      groupBy(
        rows.map((row, index) => ({ ...row, index })),
        (row) => row.story
      )
    ).flatMap(async (rowsOfStory) => {
      const story = rowsOfStory[0].story;
      const existingId = storyProducts[story!];
      const producibleId = await this.products.getProducibleId(story!);
      const matches: Array<
        ExtractedRow & {
          index: number;
          existingId: ID | undefined;
          producibleId: ID | undefined;
        }
      > = [];
      const nonExactMatches: Array<ExtractedRow & { index: number }> = [];

      for (const row of rowsOfStory) {
        if (existingId) {
          matches.push({
            ...row,
            existingId: existingId,
            producibleId: producibleId,
          });
        } else {
          nonExactMatches.push(row);
        }
      }
      return [
        ...matches,
        ...nonExactMatches.map((row) => ({
          ...row,
          existingId: undefined,
          producibleId: producibleId,
        })),
      ];
    });

    return (await Promise.all(actionableStoryRows)).flat();
  }
}

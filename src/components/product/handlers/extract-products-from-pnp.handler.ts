import { difference, groupBy, uniq } from 'lodash';
import { DateTime } from 'luxon';
import { asyncPool, ID, mapFromList, Session } from '../../../common';
import { EventsHandler, IEventHandler, ILogger, Logger } from '../../../core';
import { Engagement } from '../../engagement';
import {
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
} from '../../engagement/events';
import { FileService } from '../../file';
import { ScriptureRangeInput } from '../../scripture';
import { Book } from '../../scripture/books';
import { StoryService } from '../../story';
import {
  CreateDerivativeScriptureProduct,
  CreateDirectScriptureProduct,
  getAvailableSteps,
  ProducibleType,
  ProgressMeasurement,
  UpdateDerivativeScriptureProduct,
  UpdateDirectScriptureProduct,
} from '../dto';
import { ExtractedRow, ProductExtractor } from '../product-extractor.service';
import { ProductRepository } from '../product.repository';
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
    private readonly repo: ProductRepository,
    private readonly stories: StoryService,
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

    const actionableProductRows = await this.matchRowsToProductChanges(
      engagement,
      productRows
    );

    const storyIds = await this.getOrCreateStoriesByName(
      productRows,
      event.session
    );

    const createdAt = DateTime.now();

    // Create/update products 5 at a time.
    await asyncPool(5, actionableProductRows, async (row) => {
      const { existingId, steps, note, index } = row;

      if (row.bookName) {
        // Populate one of the two product props based on whether its a known verse range or not.
        const book = Book.find(row.bookName);
        const { totalVerses } = row;
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
          : { book: book.name, totalVerses };

        const props = {
          methodology,
          scriptureReferences,
          unspecifiedScripture,
          steps: steps.map((s) => s.step),
          describeCompletion: note,
        };
        if (existingId) {
          const updates: UpdateDirectScriptureProduct = {
            ...props,
            id: existingId,
          };
          await this.products.updateDirect(updates, event.session);
        } else {
          const create: CreateDirectScriptureProduct = {
            ...props,
            engagementId: engagement.id,
            progressStepMeasurement: ProgressMeasurement.Percent,
            // Attempt to order products in the same order as specified in the PnP
            // The default sort prop is createdAt.
            // This doesn't account for row changes in subsequent PnP uploads
            pnpIndex: index,
            createdAt: createdAt.plus({ milliseconds: index }),
          };
          await this.products.create(create, event.session);
        }
      } else if (row.story) {
        const props = {
          produces: storyIds[row.placeholder ? 'Unknown' : row.story]!,
          placeholderDescription: row.placeholder ? row.story : null,
          methodology,
          steps: steps.map((s) => s.step),
          scriptureReferencesOverride: row.scripture,
          composite: row.composite,
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
            createdAt: createdAt.plus({ milliseconds: index }),
            pnpIndex: index,
          };
          await this.products.create(create, event.session);
        }
      }
    });
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
      ? await this.products.loadProductIdsForPnpBookAndVerse(engagement.id)
      : {};

    const storyProducts = rows[0].story
      ? await this.products.loadProductIdsForPnpStories(engagement.id)
      : {};

    if (rows[0].story) {
      return rows.flatMap((row, index) => {
        if (!row.story) return [];
        if (index in storyProducts) {
          return { ...row, index, existingId: storyProducts[index]! };
        }
        return { ...row, index, existingId: undefined };
      });
    }

    const actionableProductRows = Object.values(
      groupBy(
        rows.map((row, index) => ({ ...row, index })), // save original indexes
        (row) => row.bookName // group by book name
      )
    ).flatMap((rowsOfBook, index) => {
      const bookName = rowsOfBook[0].bookName;
      if (!bookName) return [];
      const existing = scriptureProducts[index] ?? new Map<number, ID>();

      const matches: Array<
        ExtractedRow & { index: number; existingId: ID | undefined }
      > = [];
      let nonExactMatches: Array<ExtractedRow & { index: number }> = [];

      // Exact matches
      for (const row of rowsOfBook) {
        const totalVerses = row.totalVerses!;
        const existingId = existing.get(totalVerses);
        if (existingId) {
          matches.push({ ...row, existingId });
          existing.delete(totalVerses);
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

  private async getOrCreateStoriesByName(
    rows: readonly ExtractedRow[],
    session: Session
  ) {
    const names = uniq([
      'Unknown',
      ...rows.flatMap((row) =>
        row.story && !row.placeholder ? row.story : []
      ),
    ]);
    if (names.length === 1) {
      return {};
    }
    const existingList = await this.repo.getProducibleIdsByNames(
      names,
      ProducibleType.Story
    );
    const existing = mapFromList(existingList, (row) => [row.name, row.id]);
    const newNames = difference(names, Object.keys(existing));
    await asyncPool(3, newNames, async (name) => {
      const story = await this.stories.create({ name }, session);
      existing[name] = story.id;
    });
    return existing;
  }
}

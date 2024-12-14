import { Injectable } from '@nestjs/common';
import { asyncPool, groupBy, mapEntries, mapOf } from '@seedcompany/common';
import { labelOfVerseRanges } from '@seedcompany/scripture';
import { stripIndent } from 'common-tags';
import { difference, uniq } from 'lodash';
import { DateTime } from 'luxon';
import { ID, Session } from '~/common';
import { ILogger, Logger } from '~/core';
import { Downloadable, FileVersion } from '../file/dto';
import { PnpExtractionResult, PnpProblemType } from '../pnp/extraction-result';
import { StoryService } from '../story';
import {
  CreateDerivativeScriptureProduct,
  CreateDirectScriptureProduct,
  DerivativeScriptureProduct,
  ProducibleType,
  ProductMethodology,
  ProductStep,
  ProgressMeasurement,
  UpdateDerivativeScriptureProduct,
  UpdateDirectScriptureProduct,
} from './dto';
import { ExtractedRow, ProductExtractor } from './product.extractor';
import { ProductRepository } from './product.repository';
import { ProductService } from './product.service';

@Injectable()
export class PnpProductSyncService {
  constructor(
    private readonly extractor: ProductExtractor,
    private readonly products: ProductService,
    private readonly repo: ProductRepository,
    private readonly stories: StoryService,
    @Logger('product:extractor') private readonly logger: ILogger,
  ) {}

  async parse({
    engagementId,
    availableSteps,
    pnp,
    result,
  }: {
    engagementId: ID<'LanguageEngagement'>;
    availableSteps: readonly ProductStep[];
    pnp: Downloadable<FileVersion>;
    result: PnpExtractionResult;
  }) {
    let productRows;
    try {
      productRows = await this.extractor.extract(pnp, availableSteps, result);
    } catch (e) {
      this.logger.warning(e.message, {
        id: pnp.id,
        exception: e,
      });
      return [];
    }
    if (productRows.length === 0) {
      return [];
    }

    return await this.matchRowsToProductChanges(
      engagementId,
      productRows,
      result,
    );
  }

  /**
   * Determine which product rows correspond to an existing product
   * or if they should create a new one or if they should be skipped.
   */
  private async matchRowsToProductChanges(
    engagementId: ID<'LanguageEngagement'>,
    rows: readonly ExtractedRow[],
    result: PnpExtractionResult,
  ) {
    const scriptureProducts = rows[0].bookName
      ? await this.products.loadProductIdsForBookAndVerse(
          engagementId,
          this.logger,
        )
      : [];

    const storyProducts = rows[0].story
      ? await this.products.loadProductIdsByPnpIndex(
          engagementId,
          DerivativeScriptureProduct.name,
        )
      : mapOf({});

    if (rows[0].story) {
      return rows.flatMap((row) => {
        if (!row.story) return [];
        return { ...row, existingId: storyProducts.get(row.rowIndex) };
      });
    }

    const actionableProductRows = groupBy(rows, (row) => {
      // group by book name
      return row.scripture[0]?.start.book ?? row.unspecifiedScripture?.book;
    }).flatMap((rowsOfBook) => {
      const bookName =
        rowsOfBook[0].scripture[0]?.start.book ??
        rowsOfBook[0].unspecifiedScripture?.book;
      if (!bookName) return [];
      let existingProductsForBook = scriptureProducts.filter(
        (ref) => ref.book === bookName,
      );

      const matches: Array<ExtractedRow & { existingId: ID | undefined }> = [];
      let nonExactMatches: ExtractedRow[] = [];

      // Exact matches
      for (const row of rowsOfBook) {
        const rowScriptureLabel = labelOfVerseRanges(row.scripture);
        const withMatches = existingProductsForBook.filter((existingRef) => {
          if (
            existingRef.scriptureRanges.length > 0 &&
            rowScriptureLabel ===
              labelOfVerseRanges(existingRef.scriptureRanges)
          ) {
            return true;
          }
          if (
            existingRef.unspecifiedScripture &&
            row.unspecifiedScripture &&
            existingRef.unspecifiedScripture.book ===
              row.unspecifiedScripture.book &&
            existingRef.unspecifiedScripture.totalVerses ===
              row.unspecifiedScripture.totalVerses
          ) {
            return true;
          }
          return false;
        });
        const existingId =
          withMatches.length === 1 ? withMatches[0].id : undefined;
        if (existingId) {
          matches.push({ ...row, existingId });
          existingProductsForBook = existingProductsForBook.filter(
            (ref) => ref.id !== existingId,
          );
        } else {
          nonExactMatches.push(row);
        }
      }

      // If there's only one product left for this book that hasn't been matched
      // And there's only one row left that can't be matched to a book & verse count
      if (
        existingProductsForBook.length === 1 &&
        nonExactMatches.length === 1
      ) {
        // Assume that ID belongs to this row.
        // Use case: A single row changes total verse count while other rows
        // for this book remain the same or are new.
        const oldVerseCountRef = existingProductsForBook[0]!;
        matches.push({
          ...nonExactMatches[0],
          existingId: oldVerseCountRef.id,
        });
        existingProductsForBook = [];
        nonExactMatches = [];
      }

      if (existingProductsForBook.length === 0) {
        // All remaining are new
        return [
          ...matches,
          ...nonExactMatches.map((row) => ({
            ...row,
            existingId: undefined,
          })),
        ];
      }

      // Future matching idea:
      // If multiple total cells changed without the rows changing,
      // then rowIndex/pnpIndex could be used to correctly match them.
      // If rows changed though like inserting a row pushing multiple down,
      // this wouldn't work without more logic.

      nonExactMatches.forEach(({ source }) => {
        const goalName = source.asString!;
        const myNoteCell = source.sheet.myNote(source.row, false);
        result.addProblem(AmbiguousGoal, source, {
          goalVal: goalName,
          noteRef: myNoteCell.ref,
        });
      });

      return matches;
    });
    return actionableProductRows;
  }

  async save({
    engagementId,
    methodology,
    actionableProductRows,
    session,
  }: {
    engagementId: ID<'LanguageEngagement'>;
    methodology: ProductMethodology;
    actionableProductRows: ReadonlyArray<
      ExtractedRow & { existingId: ID<'Product'> | undefined }
    >;
    session: Session;
  }) {
    const createdAt = DateTime.now();
    const storyIds = await this.getOrCreateStoriesByName(
      actionableProductRows,
      session,
    );

    // Create/update products 5 at a time.
    await asyncPool(5, actionableProductRows, async (row) => {
      const {
        scripture,
        unspecifiedScripture,
        existingId,
        steps,
        note,
        rowIndex: index,
      } = row;

      if (row.bookName) {
        // Populate one of the two product props based on whether it's a known verse range or not.
        const props = {
          methodology,
          scriptureReferences: scripture,
          unspecifiedScripture: unspecifiedScripture ?? null,
          steps: steps.map((s) => s.step),
          describeCompletion: note,
        };
        if (existingId) {
          const updates: UpdateDirectScriptureProduct = {
            ...props,
            id: existingId,
          };
          await this.products.updateDirect(updates, session);
        } else {
          const create: CreateDirectScriptureProduct = {
            ...props,
            engagementId,
            progressStepMeasurement: ProgressMeasurement.Percent,
            pnpIndex: index,
            // Attempt to order products in the same order as specified in the PnP
            // The default sort prop is createdAt.
            // This doesn't account for row changes in subsequent PnP uploads
            createdAt: createdAt.plus({ milliseconds: index }),
          };
          await this.products.create(create, session);
        }
      } else if (row.story) {
        const props = {
          produces: storyIds[row.placeholder ? 'Unknown' : row.story]!,
          placeholderDescription: row.placeholder
            ? `#${row.order} ${row.story}`
            : null,
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
          await this.products.updateDerivative(updates, session);
        } else {
          const create: CreateDerivativeScriptureProduct = {
            ...props,
            engagementId,
            progressStepMeasurement: ProgressMeasurement.Percent,
            pnpIndex: index,
            createdAt: createdAt.plus({ milliseconds: index }),
          };
          await this.products.create(create, session);
        }
      }
    });
  }

  private async getOrCreateStoriesByName(
    rows: readonly ExtractedRow[],
    session: Session,
  ) {
    const names = uniq(
      rows.flatMap((row) =>
        !row.story ? [] : row.placeholder ? 'Unknown' : row.story,
      ),
    );
    if (names.length === 0) {
      return {};
    }
    const existingList = await this.repo.getProducibleIdsByNames(
      names,
      ProducibleType.Story,
    );
    const existing = mapEntries(existingList, (r) => [r.name, r.id]).asRecord;
    const byName = { ...existing };
    const newNames = difference(names, Object.keys(existing));
    await asyncPool(3, newNames, async (name) => {
      const story = await this.stories.create({ name }, session);
      byName[name] = story.id;
    });
    return byName as Readonly<typeof byName>;
  }
}

const AmbiguousGoal = PnpProblemType.register({
  name: 'AmbiguousGoal',
  severity: 'Error',
  render:
    (ctx: { goalVal: string; noteRef: string }) =>
    ({ source }) => ({
      groups: 'Unable to distinguish goal row to goal in CORD',
      message: stripIndent`
        _${ctx.goalVal}_ \`${source}\` is ambiguous with other rows.
        The information in \`${ctx.noteRef}\` is insufficient or nonexistent.
      `,
    }),
});

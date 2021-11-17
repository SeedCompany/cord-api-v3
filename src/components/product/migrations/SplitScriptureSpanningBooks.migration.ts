import { node, relation } from 'cypher-query-builder';
import { from as ix } from 'ix/asynciterable';
import 'ix/add/asynciterable/from';
import 'ix/add/asynciterable-operators/flatmap';
import 'ix/add/asynciterable-operators/groupby';
import 'ix/add/asynciterable-operators/map';
import 'ix/add/asynciterable-operators/tap';
import 'ix/add/asynciterable-operators/toarray';
import { sum } from 'lodash';
import { has, ID, Range, UnsecuredDto } from '../../../common';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE } from '../../../core/database/query';
import { mapRange, ScriptureRange } from '../../scripture';
import { Book, Verse } from '../../scripture/books';
import { labelOfScriptureRanges } from '../../scripture/labels';
import {
  asProductType,
  CreateDirectScriptureProduct,
  DirectScriptureProduct,
  UpdateDirectScriptureProduct,
} from '../dto';
import { ProductService } from '../product.service';

/**
 * Split products up so that each product only references a single book.
 * #1 Product Matt-Rev -> 27 Products (all other props identical)
 */
@Migration('2021-11-26T18:12:00')
export class SplitScriptureSpanningBooksMigration extends BaseMigration {
  constructor(private readonly productService: ProductService) {
    super();
  }

  async up() {
    const changes =
      // For all books
      ix(Book)
        // Find product IDs who have scripture references spanning over this book
        // This will match the same product multiple times unless the product is
        // changed first. i.e Matt-Rev will match for Matt, Mark, etc.
        .flatMap((book) =>
          this.findProductsWithScriptureSpanningOverBooks({
            start: book.firstChapter.firstVerse.id,
            end: book.lastChapter.lastVerse.id,
          })
        )
        // Lookup the product DTO for the ID
        .map(async (id: ID) =>
          asProductType(DirectScriptureProduct)(
            await this.productService.readOneUnsecured(
              id,
              this.fakeAdminSession
            )
          )
        )
        // Split the product into multiple with a scripture refs for a single book
        // per product and return update & create inputs
        .flatMap((product) => this.splitProduct(product));

    let updated = 0;
    let created = 0;
    const stats: Record<string, number> = {};

    for await (const input of changes) {
      if (has('id', input)) {
        this.logger.info('Updating product', {
          id: input.id,
          refs: labelOfScriptureRanges(input.scriptureReferences ?? []),
        });
        await this.productService.updateDirect(input, this.fakeAdminSession);
        updated++;
        stats[input.id] = (stats[input.id] ?? 0) + 1;
      } else {
        this.logger.info('Creating product', {
          refs: labelOfScriptureRanges(input.scriptureReferences ?? []),
          ...input,
        });
        await this.productService.create(input, this.fakeAdminSession);
        created++;
        stats[input.oldId] = (stats[input.oldId] ?? 0) + 1;
      }
    }

    // Some redundancy here as a sanity check and because I can't be bothered.
    const oldProductsCount = Object.keys(stats).length;
    const newProductsCount = sum(Object.values(stats));
    this.logger.info(
      `Split ${oldProductsCount} products into ${newProductsCount} products`
    );
    this.logger.info(`Updated ${updated} products`);
    this.logger.info(`Created ${created} products`);
  }

  private async findProductsWithScriptureSpanningOverBooks(
    book: Range<number>
  ) {
    const ids = await this.db
      .query()
      .match([
        node('node', 'DirectScriptureProduct'),
        relation('out', '', 'scriptureReferences', ACTIVE),
        node('ref', 'ScriptureRange'),
      ])
      .with(['node', 'collect(ref) as refs'])
      .raw(
        `
          WHERE any(ref in refs WHERE ref.start >= $start AND ref.end <= $end) // has book
            AND any(ref in refs WHERE ref.start < $start OR ref.end > $end) // has other book
        `,
        book
      )
      .return<{ id: ID }>('node.id as id')
      .map('id')
      .run();
    return ix(ids);
  }

  private async splitProduct(product: UnsecuredDto<DirectScriptureProduct>) {
    this.logger.debug('Found product', {
      refs: labelOfScriptureRanges(product.scriptureReferences),
      product,
    });
    return ix(this.splitRefsByBook(product.scriptureReferences))
      .groupBy((ref) => ref.start.book.name)
      .map(async (ranges, index) => {
        const refs = await ranges
          .map((range) => mapRange(range, (verse) => verse.reference))
          .toArray();
        if (index === 0) {
          const update: UpdateDirectScriptureProduct = {
            id: product.id,
            scriptureReferences: refs,
          };
          return update;
        }
        const { id, scriptureReferences: _, engagement, ...rest } = product;
        const create: CreateDirectScriptureProduct & { oldId: ID } = {
          oldId: id,
          ...rest,
          engagementId: engagement,
          scriptureReferences: refs,
          describeCompletion: undefined,
        };
        return create;
      });
  }

  private *splitRefsByBook(refs: readonly ScriptureRange[]) {
    const verses = refs.map((range) => mapRange(range, Verse.fromRef));

    // eslint-disable-next-line prefer-const
    for (let { start, end } of verses) {
      while (start.book.name !== end.book.name) {
        yield {
          start,
          end: start.book.lastChapter.lastVerse,
        };
        start = start.book.next!.firstChapter.firstVerse;
      }
      yield { start, end };
    }
  }
}

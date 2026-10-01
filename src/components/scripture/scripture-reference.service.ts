import { sortBy } from '@seedcompany/common';
import { eq } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { products } from '~/core/drizzle/schema';
import { ILogger, Logger } from '~/core/logger';
import { type DbScriptureReferences } from './db-scripture-references';
import { ScriptureRange, type ScriptureRangeInput } from './dto';

export class ScriptureReferenceService {
  constructor(
    @Logger('scripture-reference:service') private readonly logger: ILogger,
    private readonly drizzle: DrizzleService,
  ) {}

  async update(
    producibleId: ID,
    scriptureRefs: readonly ScriptureRangeInput[] | null | undefined,
    options: { isOverriding?: boolean } = {},
  ): Promise<void> {
    if (scriptureRefs === undefined) {
      return;
    }

    // Scripture refs live as jsonb columns on the products row; the
    // producible repositories write their own column. A null override means
    // "not overriding".
    const refs = scriptureRefs?.map(ScriptureRange.fromReferences) ?? null;
    await this.drizzle.client
      .update(products)
      .set(
        options.isOverriding
          ? { scriptureReferencesOverride: refs }
          : { scriptureReferences: refs ?? [] },
      )
      .where(eq(products.id, producibleId));
  }

  parseList(nodes: DbScriptureReferences | readonly ScriptureRangeInput[]) {
    if (nodes.length === 0) {
      return [] as const;
    }
    if (!('properties' in nodes[0]!)) {
      return nodes as readonly ScriptureRange[];
    }
    return sortBy(
      (nodes as DbScriptureReferences).map((row) => row.properties),
      [(range) => range.start, (range) => range.end],
    ).map(ScriptureRange.fromIds);
  }
}

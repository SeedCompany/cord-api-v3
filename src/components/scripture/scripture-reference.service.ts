import { sortBy } from '@seedcompany/common';
import { eq } from 'drizzle-orm';
import { type ID } from '~/common';
import { ConfigService } from '~/core/config';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { products } from '~/core/drizzle/schema';
import { ILogger, Logger } from '~/core/logger';
import { ScriptureRange, type ScriptureRangeInput } from './dto';
import {
  type DbScriptureReferences,
  ScriptureReferenceRepository,
} from './scripture-reference.repository';

export class ScriptureReferenceService {
  constructor(
    @Logger('scripture-reference:service') private readonly logger: ILogger,
    private readonly repo: ScriptureReferenceRepository,
    private readonly config: ConfigService,
    private readonly drizzle: DrizzleService,
  ) {}

  async create(
    producibleId: ID,
    scriptureRefs: readonly ScriptureRangeInput[] | undefined,
    // eslint-disable-next-line @seedcompany/no-unused-vars
  ): Promise<void> {
    if (!scriptureRefs) {
      return;
    }

    for (const sr of scriptureRefs) {
      await this.repo.create(sr, producibleId);
    }
  }

  async update(
    producibleId: ID,
    scriptureRefs: readonly ScriptureRangeInput[] | null | undefined,
    options: { isOverriding?: boolean } = {},
  ): Promise<void> {
    if (scriptureRefs === undefined) {
      return;
    }

    // Under postgres, scripture refs live as jsonb columns on the products
    // row (the only flow that reaches this service post-`splitDb` — the
    // producible drizzle repos write their own column). A null override
    // means "not overriding", replacing Neo4j's isOverriding flag.
    // migration-todo: this branch IS the postgres implementation — at Phase 7
    // cutover drop the engine check + the Neo4j path below (repo calls),
    // leaving only this body.
    if (this.config.databaseEngine === 'postgres') {
      const refs = scriptureRefs?.map(ScriptureRange.fromReferences) ?? null;
      await this.drizzle.client
        .update(products)
        .set(
          options.isOverriding
            ? { scriptureReferencesOverride: refs }
            : { scriptureReferences: refs ?? [] },
        )
        .where(eq(products.id, producibleId));
      return;
    }

    const rel = options.isOverriding
      ? 'scriptureReferencesOverride'
      : 'scriptureReferences';

    await this.repo.update(
      options.isOverriding,
      producibleId,
      scriptureRefs,
      rel,
    );

    if (scriptureRefs !== null) {
      for (const sr of scriptureRefs) {
        await this.repo.updateScriptureRefs(sr, producibleId, rel);
      }
    }
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

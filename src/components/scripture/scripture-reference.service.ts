import { sortBy } from '@seedcompany/common';
import { type ID } from '~/common';
import { ILogger, Logger } from '~/core';
import { ScriptureRange, type ScriptureRangeInput } from './dto';
import {
  type DbScriptureReferences,
  ScriptureReferenceRepository,
} from './scripture-reference.repository';

export class ScriptureReferenceService {
  constructor(
    @Logger('scripture-reference:service') private readonly logger: ILogger,
    private readonly repo: ScriptureReferenceRepository,
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

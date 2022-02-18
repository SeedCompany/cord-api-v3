import { sortBy } from 'lodash';
import { ID, Session } from '../../common';
import { ILogger, Logger } from '../../core';
import { ScriptureRange, ScriptureRangeInput } from './dto';
import {
  DbScriptureReferences,
  ScriptureReferenceRepository,
} from './scripture-reference.repository';

export class ScriptureReferenceService {
  constructor(
    @Logger('scripture-reference:service') private readonly logger: ILogger,
    private readonly repo: ScriptureReferenceRepository
  ) {}

  async create(
    producibleId: ID,
    scriptureRefs: readonly ScriptureRangeInput[] | undefined,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    session: Session
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
    options: { isOverriding?: boolean } = {}
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
      rel
    );

    if (scriptureRefs !== null) {
      for (const sr of scriptureRefs) {
        await this.repo.updateScriptureRefs(sr, producibleId, rel);
      }
    }
  }

  parseList(nodes: DbScriptureReferences) {
    return sortBy(
      nodes.map((row) => row.properties),
      [(range) => range.start, (range) => range.end]
    ).map(ScriptureRange.fromIds);
  }
}

import { Node, node, relation } from 'cypher-query-builder';
import { sortBy } from 'lodash';
import { DateTime } from 'luxon';
import { ID, Range, Session } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { ScriptureRange, ScriptureRangeInput } from './dto';
import { ScriptureReferenceRepository } from './scripture-reference.repository';

export class ScriptureReferenceService {
  constructor(
    @Logger('scripture-reference:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly repo: ScriptureReferenceRepository
  ) {}

  async create(
    producibleId: ID,
    scriptureRefs: ScriptureRangeInput[] | undefined,
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
    scriptureRefs: ScriptureRangeInput[] | undefined,
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

  async list(
    producibleId: ID,
    session: Session,
    options: { isOverriding?: boolean } = {}
  ): Promise<ScriptureRange[]> {
    const results = await this.repo.listScriptureRanges(
      options.isOverriding,
      producibleId
    );

    return sortBy(
      results.map((row) => row.scriptureRanges.properties),
      [(range) => range.start, (range) => range.end]
    ).map(ScriptureRange.fromIds);
  }
}

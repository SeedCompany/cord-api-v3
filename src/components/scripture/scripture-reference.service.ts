import { Node, node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { ScriptureRange, ScriptureRangeInput } from './dto';
import { scriptureToVerseRange, verseToScriptureRange } from './reference';

export class ScriptureReferenceService {
  constructor(
    @Logger('scriptureReference:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  async create(
    producibleId: string,
    label: string,
    session: ISession,
    scriptureRefs: ScriptureRangeInput[]
  ): Promise<void> {
    const rel = 'scriptureReferences';
    for (const sr of scriptureRefs) {
      await this.db
        .query()
        .match([
          node('node', label, {
            id: producibleId,
            active: true,
            owningOrgId: session.owningOrgId,
          }),
        ])
        .create([
          node('node'),
          relation('out', '', rel, { active: true }),
          node('sr', ['ScriptureRange', 'BaseNode'], {
            ...scriptureToVerseRange(sr),
            active: true,
            createdAt: DateTime.local(),
          }),
        ])
        .return('node')
        .run();
    }
  }

  async update(
    producibleId: string,
    label: string,
    scriptureRefs: ScriptureRangeInput[]
  ): Promise<void> {
    const rel = 'scriptureReferences';
    await this.db
      .query()
      .match([
        node('node', label, { id: producibleId, active: true }),
        relation('out', 'rel', rel, { active: true }),
        node('sr', 'ScriptureRange', { active: true }),
      ])
      .setValues({
        'rel.active': false,
        'sr.active': false,
      })
      .return('sr')
      .run();

    for (const sr of scriptureRefs) {
      await this.db
        .query()
        .match([node('node', label, { id: producibleId, active: true })])
        .create([
          node('node'),
          relation('out', '', rel, { active: true }),
          node('', ['ScriptureRange', 'BaseNode'], {
            ...scriptureToVerseRange(sr),
            active: true,
            createdAt: DateTime.local(),
          }),
        ])
        .return('node')
        .run();
    }
  }

  async list(
    producibleId: string,
    label: string,
    session: ISession
  ): Promise<ScriptureRange[]> {
    const rel = 'scriptureReferences';
    const results = await this.db
      .query()
      .match([
        node('node', label, {
          id: producibleId,
          active: true,
          owningOrgId: session.owningOrgId,
        }),
        relation('out', '', rel),
        node('scriptureRanges', 'ScriptureRange', { active: true }),
      ])
      .return('scriptureRanges')
      .asResult<{ scriptureRanges: Node<{ start: number; end: number }> }>()
      .run();

    return results.map((item) =>
      verseToScriptureRange({
        start: item.scriptureRanges.properties.start,
        end: item.scriptureRanges.properties.end,
      })
    );
  }
}

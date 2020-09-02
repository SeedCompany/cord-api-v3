import { Node, node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
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
    owningOrgId: string | undefined,
    scriptureRefs: ScriptureRangeInput[] | undefined
  ): Promise<void> {
    if (scriptureRefs) {
      const rel = 'scriptureReferences';
      for (const sr of scriptureRefs) {
        await this.db
          .query()
          .match([
            node('node', 'BaseNode', {
              id: producibleId,
              active: true,
              owningOrgId,
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
  }

  async update(
    producibleId: string,
    scriptureRefs: ScriptureRangeInput[] | undefined
  ): Promise<void> {
    if (scriptureRefs) {
      const rel = 'scriptureReferences';
      await this.db
        .query()
        .match([
          node('node', 'BaseNode', { id: producibleId, active: true }),
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
          .match([node('node', 'BaseNode', { id: producibleId, active: true })])
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
  }

  async list(
    producibleId: string,
    owningOrgId: string | undefined
  ): Promise<ScriptureRange[]> {
    const rel = 'scriptureReferences';
    const results = await this.db
      .query()
      .match([
        node('node', 'BaseNode', {
          id: producibleId,
          active: true,
          owningOrgId,
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

import { Node, node, relation } from 'cypher-query-builder';
import { sortBy } from 'lodash';
import { DateTime } from 'luxon';
import { Range, Session } from '../../common';
import { DatabaseService, ILogger, Logger, Transactional } from '../../core';
import { ScriptureRange, ScriptureRangeInput } from './dto';

export class ScriptureReferenceService {
  constructor(
    @Logger('scripture-reference:service') private readonly logger: ILogger,
    private readonly db: DatabaseService
  ) {}

  @Transactional()
  async create(
    producibleId: string,
    scriptureRefs: ScriptureRangeInput[] | undefined,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    session: Session
  ): Promise<void> {
    if (!scriptureRefs) {
      return;
    }

    for (const sr of scriptureRefs) {
      await this.db
        .query()
        .match([
          node('node', 'BaseNode', {
            id: producibleId,
          }),
        ])
        .create([
          node('node'),
          relation('out', '', 'scriptureReferences', { active: true }),
          node('sr', ['ScriptureRange', 'BaseNode'], {
            ...ScriptureRange.fromReferences(sr),

            createdAt: DateTime.local(),
          }),
        ])
        .return('node')
        .run();
    }
  }

  @Transactional()
  async update(
    producibleId: string,
    scriptureRefs: ScriptureRangeInput[] | undefined,
    options: { isOverriding?: boolean } = {}
  ): Promise<void> {
    if (scriptureRefs === undefined) {
      return;
    }

    const rel = options.isOverriding
      ? 'scriptureReferencesOverride'
      : 'scriptureReferences';

    if (options.isOverriding) {
      await this.db
        .query()
        .match([
          node('product', 'Product', { id: producibleId }),
          relation('out', 'rel', 'isOverriding', { active: true }),
          node('propertyNode', 'Property'),
        ])
        .setValues({
          'propertyNode.value': scriptureRefs !== null,
        })
        .run();
    }

    await this.db
      .query()
      .match([
        node('node', 'BaseNode', { id: producibleId }),
        relation('out', 'rel', rel, { active: true }),
        node('sr', 'ScriptureRange'),
      ])
      .setValues({
        'rel.active': false,
        'sr.active': false,
      })
      .return('sr')
      .run();

    if (scriptureRefs !== null) {
      for (const sr of scriptureRefs) {
        await this.db
          .query()
          .match([node('node', 'BaseNode', { id: producibleId })])
          .create([
            node('node'),
            relation('out', '', rel, { active: true }),
            node('', ['ScriptureRange', 'BaseNode'], {
              ...ScriptureRange.fromReferences(sr),

              createdAt: DateTime.local(),
            }),
          ])
          .return('node')
          .run();
      }
    }
  }

  @Transactional()
  async list(
    producibleId: string,
    session: Session,
    options: { isOverriding?: boolean } = {}
  ): Promise<ScriptureRange[]> {
    const results = await this.db
      .query()
      .match([
        node('node', 'BaseNode', {
          id: producibleId,
        }),
        relation(
          'out',
          '',
          options.isOverriding
            ? 'scriptureReferencesOverride'
            : 'scriptureReferences',
          {
            active: true,
          }
        ),
        node('scriptureRanges', 'ScriptureRange'),
      ])
      .return('scriptureRanges')
      .asResult<{ scriptureRanges: Node<Range<number>> }>()
      .run();

    return sortBy(
      results.map((row) => row.scriptureRanges.properties),
      [(range) => range.start, (range) => range.end]
    ).map(ScriptureRange.fromIds);
  }
}

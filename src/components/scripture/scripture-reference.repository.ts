import { Injectable } from '@nestjs/common';
import { Node, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Range } from '~/common';
import { DatabaseService } from '~/core/database';
import { ACTIVE, collect } from '~/core/database/query';
import { ScriptureRange, ScriptureRangeInput } from './dto';

export type DbScriptureReferences = ReadonlyArray<Node<Range<number>>>;

@Injectable()
export class ScriptureReferenceRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(sr: ScriptureRangeInput, producibleId: ID) {
    await this.db
      .query()
      .match([
        node('node', 'BaseNode', {
          id: producibleId,
        }),
      ])
      .create([
        node('node'),
        relation('out', '', 'scriptureReferences', ACTIVE),
        node('sr', ['ScriptureRange', 'BaseNode'], {
          ...ScriptureRange.fromReferences(sr),

          createdAt: DateTime.local(),
        }),
      ])
      .return('node')
      .run();
  }

  async update(
    isOverriding: boolean | undefined,
    producibleId: ID,
    scriptureRefs: readonly ScriptureRangeInput[] | null,
    rel: 'scriptureReferencesOverride' | 'scriptureReferences',
  ) {
    if (isOverriding) {
      await this.db
        .query()
        .match([
          node('product', 'Product', { id: producibleId }),
          relation('out', 'rel', 'isOverriding', ACTIVE),
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
        relation('out', 'rel', rel, ACTIVE),
        node('sr', 'ScriptureRange'),
      ])
      .setValues({
        'rel.active': false,
        'sr.active': false,
      })
      .return('sr')
      .run();
  }

  async updateScriptureRefs(
    sr: ScriptureRangeInput,
    producibleId: ID,
    rel: 'scriptureReferencesOverride' | 'scriptureReferences',
  ) {
    await this.db
      .query()
      .match([node('node', 'BaseNode', { id: producibleId })])
      .create([
        node('node'),
        relation('out', '', rel, ACTIVE),
        node('', ['ScriptureRange', 'BaseNode'], {
          ...ScriptureRange.fromReferences(sr),

          createdAt: DateTime.local(),
        }),
      ])
      .return('node')
      .run();
  }

  list({
    nodeName = 'node',
    relationName = 'scriptureReferences',
    outVar = 'scriptureReferences',
  }: {
    nodeName?: string;
    relationName?: string;
    outVar?: string;
  } = {}) {
    const dynamicRel = !!relationName.match(/['"]/);
    return (query: Query) =>
      query
        .comment('ScriptureRefs.list()')
        .match([
          node(nodeName),
          relation(
            'out',
            'scriptureRangeRel',
            dynamicRel ? undefined : relationName,
            ACTIVE,
          ),
          node('scriptureRange', 'ScriptureRange'),
        ])
        .apply((q) =>
          dynamicRel
            ? q.raw(`WHERE type(scriptureRangeRel) = ${relationName}`)
            : q,
        )
        .return<{ scriptureReferences: DbScriptureReferences }>(
          collect('scriptureRange').as(outVar),
        );
  }
}

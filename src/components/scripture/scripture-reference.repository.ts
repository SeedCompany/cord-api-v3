import { Injectable } from '@nestjs/common';
import { Node, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, Range } from '../../common';
import { DatabaseService } from '../../core';
import { ACTIVE, collect, INACTIVE } from '../../core/database/query';
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
    changeset?: ID
  ) {
    changeset = await this.db.checkCreatedInChangeset(
      'Product',
      producibleId,
      changeset
    );

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
        relation('out', 'rel', rel, { active: !changeset }),
        node('sr', 'ScriptureRange'),
        ...(changeset
          ? [
              relation('in', 'oldChange', 'changeset', ACTIVE),
              node('changeNode', 'Changeset', { id: changeset }),
            ]
          : []),
      ])
      .setValues({
        [`${changeset ? 'oldChange' : 'rel'}.active`]: false,
        'sr.active': false, // I think that this is inactive no matter whether it's a change of a changeset... not sure though...
      })
      .return('sr')
      .run();
  }

  async updateScriptureRefs(
    sr: ScriptureRangeInput,
    producibleId: ID,
    rel: 'scriptureReferencesOverride' | 'scriptureReferences',
    changeset?: ID
  ) {
    changeset = await this.db.checkCreatedInChangeset(
      'Product',
      producibleId,
      changeset
    );
    await this.db
      .query()
      .apply((q) =>
        changeset
          ? q.match(node('changeset', 'Changeset', { id: changeset })) //doing things a little different here from db.create-property because we want to create an entirely new list with old and new values.
          : q
      )
      .match([node('node', 'BaseNode', { id: producibleId })])
      .create([
        node('node'),
        relation('out', '', rel, { active: !changeset }),
        node('', ['ScriptureRange', 'BaseNode'], {
          ...ScriptureRange.fromReferences(sr),

          createdAt: DateTime.local(),
        }),
        ...(changeset
          ? [relation('in', '', 'changeset', ACTIVE), node('changeset')]
          : []),
      ])
      .return('node')
      .run();
  }

  list({
    nodeName = 'node',
    relationName = 'scriptureReferences',
    outVar = 'scriptureReferences',
    changeset,
  }: {
    nodeName?: string;
    relationName?: string;
    outVar?: string;
    changeset?: ID;
    importVars?: string[];
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
            changeset ? INACTIVE : ACTIVE
          ),
          node('scriptureRange', 'ScriptureRange'),
          ...(changeset
            ? [
                relation('in', '', 'changeset', ACTIVE),
                node('changeset', 'Changeset', { id: changeset }),
              ]
            : []),
        ])
        .apply((q) =>
          dynamicRel
            ? q.raw(`WHERE type(scriptureRangeRel) = ${relationName}`)
            : q
        )
        .return<{ scriptureReferences: DbScriptureReferences }>(
          collect('scriptureRange').as(outVar)
        );
  }
}

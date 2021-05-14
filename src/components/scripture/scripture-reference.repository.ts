import { Injectable } from '@nestjs/common';
import { Node, node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { generateId, ID, Session, Range } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { ScriptureRange, ScriptureRangeInput } from './dto';

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
        relation('out', '', 'scriptureReferences', { active: true }),
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
    scriptureRefs: ScriptureRangeInput[],
    rel: 'scriptureReferencesOverride' | 'scriptureReferences'
  ) {
    if (isOverriding) {
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
  }

  async updateScriptureRefs(
    sr: ScriptureRangeInput,
    producibleId: ID,
    rel: 'scriptureReferencesOverride' | 'scriptureReferences'
  ) {
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

  async listScriptureRanges(
    isOverriding: boolean | undefined,
    producibleId: ID
  ) {
    return await this.db
      .query()
      .match([
        node('node', 'BaseNode', {
          id: producibleId,
        }),
        relation(
          'out',
          '',
          isOverriding ? 'scriptureReferencesOverride' : 'scriptureReferences',
          {
            active: true,
          }
        ),
        node('scriptureRanges', 'ScriptureRange'),
      ])
      .return('scriptureRanges')
      .asResult<{ scriptureRanges: Node<Range<number>> }>()
      .run();
  }
}

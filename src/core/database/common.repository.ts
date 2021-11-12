import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  getDbPropertyUnique,
  ID,
  isIdLike,
  Many,
  ResourceShape,
  ServerException,
  Session,
} from '../../common';
import { DatabaseService } from './database.service';
import { createUniqueConstraint } from './indexer';
import { ACTIVE } from './query';
import { BaseNode } from './results';

/**
 * This provides a few methods out of the box.
 */
@Injectable()
export class CommonRepository {
  constructor(protected db: DatabaseService) {}

  async getBaseNode(
    id: ID,
    label?: Many<string>
  ): Promise<BaseNode | undefined> {
    return await this.db
      .query()
      .matchNode('node', label ?? 'BaseNode', { id })
      .return<{ node: BaseNode }>('node')
      .map('node')
      .first();
  }

  async updateRelation(
    relationName: string,
    otherLabel: string,
    id: ID,
    otherId: ID | null,
    label?: string
  ) {
    await this.db
      .query()
      .match([
        [node('node', label ?? 'BaseNode', { id })],
        otherId ? [node('other', otherLabel, { id: otherId })] : [],
      ])
      .subQuery('node', (sub) =>
        sub
          .match([
            node('node'),
            relation('out', 'oldRel', relationName, ACTIVE),
            node('', otherLabel),
          ])
          .setVariables({
            'oldRel.active': 'false',
            'oldRel.deletedAt': 'datetime()',
          })
          // Ensure exactly one row is returned, for the create below
          .return('count(oldRel) as removedRelationCount')
      )
      .create([
        node('node'),
        relation('out', '', relationName, {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('other'),
      ])
      .run();
  }

  async checkDeletePermission(id: ID, session: Session | ID) {
    return await this.db.checkDeletePermission(id, session);
  }

  async deleteNode(objectOrId: { id: ID } | ID, changeset?: ID) {
    if (!changeset) {
      await this.db.deleteNode(objectOrId);
      return;
    }
    try {
      const id = isIdLike(objectOrId) ? objectOrId : objectOrId.id;
      await this.db
        .query()
        .match([node('node', 'BaseNode', { id })])
        .match([node('changeset', 'Changeset', { id: changeset })])
        .merge([
          node('changeset'),
          relation('out', 'rel', 'changeset'),
          node('node'),
        ])
        .setValues({ 'rel.active': true, 'rel.deleting': true })
        .run();
    } catch (e) {
      throw new ServerException('Failed to remove node in changeset', e);
    }
  }

  protected getConstraintsFor(resource: ResourceShape<any>) {
    return [
      ...(resource.Props.includes('id')
        ? [createUniqueConstraint(resource.name, 'id')]
        : []),
      ...resource.Props.flatMap((prop) => {
        const label = getDbPropertyUnique(resource, prop);
        return label
          ? createUniqueConstraint(label, 'value', `${resource.name}_${prop}`)
          : [];
      }),
    ];
  }
}

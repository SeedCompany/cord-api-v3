import { Inject, Injectable, Optional } from '@nestjs/common';
import { setOf } from '@seedcompany/common';
import { inArray, node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  getDbClassLabels,
  getDbPropertyUnique,
  ID,
  InputException,
  isIdLike,
  NotFoundException,
  ResourceShape,
  ServerException,
  Session,
} from '../../common';
import { DatabaseService } from './database.service';
import { createUniqueConstraint } from './indexer';
import { ACTIVE, updateRelationList } from './query';
import { BaseNode } from './results';

/**
 * This provides a few methods out of the box.
 */
@Injectable()
export class CommonRepository {
  @Inject(DatabaseService)
  protected db: DatabaseService;

  // eslint-disable-next-line @typescript-eslint/no-empty-function,@typescript-eslint/no-useless-constructor
  constructor(@Optional() _old?: unknown) {}

  async isUnique(value: string, label: string) {
    const exists = await this.db
      .query()
      .matchNode('node', label, { value })
      .return('node')
      .first();
    return !exists;
  }

  async getBaseNode(
    id: ID,
    label?: string | ResourceShape<any> | EnhancedResource<any>,
  ): Promise<BaseNode | undefined> {
    const res = await this.getBaseNodes([id], label);
    return res[0];
  }

  async getBaseNodes(
    ids: readonly ID[],
    label?: string | ResourceShape<any> | EnhancedResource<any>,
  ): Promise<readonly BaseNode[]> {
    const resolvedLabel = label
      ? typeof label === 'string'
        ? label
        : EnhancedResource.of(label).dbLabel
      : 'BaseNode';
    return await this.db
      .query()
      .matchNode('node', resolvedLabel)
      .where({ 'node.id': inArray(ids) })
      .return<{ node: BaseNode }>('node')
      .map('node')
      .run();
  }

  async updateRelation(
    relationName: string,
    otherLabel: string,
    id: ID,
    otherId: ID | null,
    label?: string,
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
          .return('count(oldRel) as removedRelationCount'),
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

  async updateRelationList({
    id,
    label,
    relation,
    newList,
  }: {
    id: ID;
    label?: string | EnhancedResource<any> | ResourceShape<any>;
    relation: string;
    newList: readonly ID[];
  }) {
    const resolvedLabel = !label
      ? 'BaseNode'
      : typeof label === 'string'
      ? label
      : EnhancedResource.of(label).dbLabel;
    const res = await this.db
      .query()
      .matchNode('node', resolvedLabel, { id })
      .apply(updateRelationList({ relation, newList }))
      .return('node, stats')
      .first();
    if (!res) {
      throw new NotFoundException();
    }
    if (res.stats.totalCount !== newList.length) {
      const validNodes = await this.getBaseNodes(newList);
      const validIds = setOf(validNodes.map((n) => n.properties.id));
      throw new InvalidReferencesException(
        newList.filter((id) => !validIds.has(id)),
      );
    }
    return res.stats;
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
        ? [createUniqueConstraint(getDbClassLabels(resource)[0], 'id')]
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

export class InvalidReferencesException extends InputException {
  constructor(readonly invalidIds: readonly ID[]) {
    super('Could not find some IDs given');
  }
}

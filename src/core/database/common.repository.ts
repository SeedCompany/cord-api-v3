import { Inject, Injectable } from '@nestjs/common';
import { setOf } from '@seedcompany/common';
import { inArray, node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DbUnique,
  EnhancedResource,
  type ID,
  InputException,
  isIdLike,
  NotFoundException,
  type ResourceShape,
  ServerException,
} from '~/common';
import { type ResourceLike, ResourcesHost } from '../resources';
import { DatabaseService, DbTraceLayer } from './database.service';
import { createUniqueConstraint } from './indexer';
import { ACTIVE, deleteBaseNode, updateRelationList } from './query';
import { type BaseNode } from './results';

/**
 * This provides a few methods out of the box.
 */
@Injectable()
export class CommonRepository {
  @Inject() protected db: DatabaseService;
  @Inject() protected readonly resources: ResourcesHost;

  constructor() {
    DbTraceLayer.applyToInstance(this);
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

  protected async updateRelation(
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
      .apply((q) =>
        otherId
          ? q.create([
              node('node'),
              relation('out', '', relationName, {
                active: true,
                createdAt: DateTime.local(),
              }),
              node('other'),
            ])
          : q,
      )
      .return('*')
      .run();
  }

  protected async updateRelationList({
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

  async deleteNode(
    objectOrId: { id: ID } | ID,
    { changeset, resource }: { changeset?: ID; resource?: ResourceLike } = {},
  ) {
    const id = isIdLike(objectOrId) ? objectOrId : objectOrId.id;
    const label = resource
      ? this.resources.enhance(resource).dbLabel
      : 'BaseNode';
    if (!changeset) {
      await this.db
        .query()
        .matchNode('node', label, { id })
        .apply(deleteBaseNode('node'))
        .return('*')
        .run();
      return;
    }
    try {
      await this.db
        .query()
        .match(node('node', label, { id }))
        .match(node('changeset', 'Changeset', { id: changeset }))
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
    const { dbLabel } = EnhancedResource.of(resource);
    return [
      ...(resource.Props.includes('id')
        ? [createUniqueConstraint(dbLabel, 'id')]
        : []),
      ...resource.Props.flatMap((prop) => {
        const label = DbUnique.get(resource, prop);
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

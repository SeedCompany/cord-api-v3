import { Injectable } from '@nestjs/common';
import { inArray, Query } from 'cypher-query-builder';
import { lowerCase } from 'lodash';
import {
  getDbClassLabels,
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  ResourceShape,
  UnsecuredDto,
} from '../../common';
import { DbChanges, getChanges } from './changes';
import { CommonRepository } from './common.repository';
import { OnIndex } from './indexer';
import { matchProps } from './query';

/**
 * A repository for a simple DTO. This provides a few methods out of the box.
 */
export const DtoRepository = <
  TResourceStatic extends ResourceShape<any>,
  HydrateArgs extends unknown[] = []
>(
  resource: TResourceStatic
) => {
  @Injectable()
  class DtoRepositoryClass extends CommonRepository {
    getActualChanges = getChanges(resource);

    async getBaseNode(id: ID, label?: string | ResourceShape<any>) {
      return await super.getBaseNode(id, label ?? resource);
    }

    async readOne(id: ID, ...args: HydrateArgs) {
      const rows = await this.readMany([id], ...args);
      if (!rows[0]) {
        throw new NotFoundException(
          `Could not find ${lowerCase(resource.name)}`
        );
      }
      return rows[0];
    }

    async readMany(ids: readonly ID[], ...args: HydrateArgs) {
      return await this.db
        .query()
        .matchNode('node', getDbClassLabels(resource)[0])
        .where({ 'node.id': inArray(ids) })
        .apply(this.hydrate(...args))
        .map('dto')
        .run();
    }

    async updateProperties<
      TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
        id: ID;
      }
    >(
      object: TObject,
      changes: DbChanges<TResourceStatic['prototype']>,
      changeset?: ID
    ) {
      return await this.db.updateProperties({
        type: resource,
        object,
        changes,
        changeset,
      });
    }

    async updateRelation(
      relationName: string,
      otherLabel: string,
      id: ID,
      otherId: ID | null
    ) {
      await super.updateRelation(
        relationName,
        otherLabel,
        id,
        otherId,
        getDbClassLabels(resource)[0]
      );
    }

    /**
     * Given a `(node:TBaseNode)` output `dto` as `UnsecuredDto<TResource>`
     *
     * This default implementation only pulls a BaseNode's own properties.
     * Override this method to query for anything else needed to fulfill the DTO.
     */
    protected hydrate(..._args: HydrateArgs) {
      return (query: Query) =>
        query
          .apply(matchProps())
          .return<{ dto: UnsecuredDto<TResourceStatic['prototype']> }>(
            'props as dto'
          );
    }

    @OnIndex()
    private createResourceIndexes() {
      return this.getConstraintsFor(resource);
    }
  }

  return DtoRepositoryClass;
};

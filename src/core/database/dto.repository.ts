import { Inject, Injectable } from '@nestjs/common';
import { inArray, Query } from 'cypher-query-builder';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { lowerCase } from 'lodash';
import {
  EnhancedResource,
  getDbPropertyUnique,
  ID,
  NotFoundException,
  ResourceShape,
  ServerException,
  UnsecuredDto,
} from '~/common';
import { Privileges } from '../../components/authorization';
import { DbChanges, getChanges } from './changes';
import { CommonRepository } from './common.repository';
import { DbTypeOf } from './db-type';
import { OnIndex } from './indexer';
import { matchProps } from './query';

export const privileges = Symbol.for('DtoRepository.privileges');

/**
 * A repository for a simple DTO. This provides a few methods out of the box.
 */
export const DtoRepository = <
  TResourceStatic extends ResourceShape<any>,
  HydrateArgs extends unknown[] = [],
  // Specify this if the repo is for an interface, but works with all the concretes.
  TResource extends InstanceType<TResourceStatic> = InstanceType<TResourceStatic>,
>(
  resource: TResourceStatic,
) => {
  @Injectable()
  class DtoRepositoryClass extends CommonRepository {
    @Inject(Privileges)
    protected readonly [privileges]: Privileges;
    protected readonly resource = EnhancedResource.of(resource);

    @Once()
    get privileges() {
      return this[privileges].forResource(resource);
    }

    getActualChanges = getChanges(resource);

    /**
     * Check if value is unique for this resource.
     * Label can be omitted if there's a single @DbUnique() property on the resource.
     */
    async isUnique(value: string, label?: string) {
      if (!label) {
        const defaultLabel = this.uniqueLabel;
        if (defaultLabel instanceof Error) {
          throw defaultLabel;
        }
        label = defaultLabel;
      }
      const exists = await this.db
        .query()
        .matchNode('node', label, { value })
        .return('node')
        .first();
      return !exists;
    }
    @Once() private get uniqueLabel() {
      const labels = resource.Props.flatMap(
        (p) => getDbPropertyUnique(resource, p) ?? [],
      );
      if (labels.length === 0) {
        return new ServerException(
          `No unique properties found in ${resource.name}`,
        );
      }
      if (labels.length > 1) {
        return new ServerException(
          `Multiple unique properties found in ${resource.name}, not sure which one to use.`,
        );
      }
      return labels[0];
    }

    async getBaseNode(id: ID, label?: string | ResourceShape<any>) {
      return await super.getBaseNode(id, label ?? resource);
    }

    async readOne(id: ID, ...args: HydrateArgs) {
      const rows = await this.readMany([id], ...args);
      if (!rows[0]) {
        throw new NotFoundException(
          `Could not find ${lowerCase(resource.name)}`,
        );
      }
      return rows[0];
    }

    async readMany(ids: readonly ID[], ...args: HydrateArgs) {
      return await this.db
        .query()
        .matchNode('node', this.resource.dbLabel)
        .where({ 'node.id': inArray(ids) })
        .apply(this.hydrate(...args))
        .map('dto')
        .run();
    }

    protected async updateProperties<
      TObject extends Partial<TResource | UnsecuredDto<TResource>> & {
        id: ID;
      },
    >(object: TObject, changes: DbChanges<TResource>, changeset?: ID) {
      return await this.db.updateProperties({
        type: resource,
        object,
        changes,
        changeset,
      });
    }

    protected async updateRelation(
      relationName: string,
      otherLabel: string,
      id: ID,
      otherId: ID | null,
    ) {
      await super.updateRelation(
        relationName,
        otherLabel,
        id,
        otherId,
        this.resource.dbLabel,
      );
    }

    protected async updateRelationList(
      options: Parameters<CommonRepository['updateRelationList']>[0],
    ) {
      return await super.updateRelationList({
        label: resource,
        ...options,
      });
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
          .return<{ dto: DbTypeOf<TResource> }>('props as dto');
    }

    @OnIndex()
    private createResourceIndexes() {
      return this.getConstraintsFor(resource);
    }
  }

  return DtoRepositoryClass;
};

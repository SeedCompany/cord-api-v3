import { Injectable } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import {
  ID,
  MaybeUnsecuredInstance,
  ResourceShape,
  UnsecuredDto,
} from '../../common';
import { DbChanges, getChanges } from './changes';
import { CommonRepository } from './common.repository';
import { matchProps } from './query';

/**
 * A repository for a simple DTO. This provides a few methods out of the box.
 */
export const DtoRepository = <TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic
) => {
  @Injectable()
  class DtoRepositoryClass extends CommonRepository {
    getActualChanges = getChanges(resource);

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

    /**
     * Given a `(node:TBaseNode)` output `dto` as `UnsecuredDto<TResource>`
     *
     * This default implementation only pulls a BaseNode's own properties.
     * Override this method to query for anything else needed to fulfill the DTO.
     *
     * Note we allow any ars here so that sub-classes can add any args they want.
     * This is just a default for them.
     */
    protected hydrate(..._args: unknown[]) {
      return (query: Query) =>
        query
          .apply(matchProps())
          .return<{ dto: UnsecuredDto<TResourceStatic['prototype']> }>(
            'props as dto'
          );
    }
  }

  return DtoRepositoryClass;
};

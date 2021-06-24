import { Injectable } from '@nestjs/common';
import { ID, MaybeUnsecuredInstance, ResourceShape } from '../../common';
import { DbChanges, getChanges } from './changes';
import { CommonRepository } from './common.repository';

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
  }

  return DtoRepositoryClass;
};

import { Injectable } from '@nestjs/common';
import { type ID } from '~/common';
import { type LinkToUnknown } from '~/core/resources';

/**
 * Changesets were not carried forward to Postgres: no changeset can exist, so
 * there is never a difference to report. The GraphQL surface stays because
 * clients still select it; `Query.changeset` already answers "not found"
 * through the change-request repository.
 */
@Injectable()
export class ChangesetRepository {
  async difference(
    _id: ID,
    _parent?: ID,
  ): Promise<
    Record<'added' | 'removed' | 'changed', readonly LinkToUnknown[]>
  > {
    return { added: [], removed: [], changed: [] };
  }
}

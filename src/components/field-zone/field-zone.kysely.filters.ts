import { type SelectQueryBuilder } from 'kysely';
import type { Database } from '~/core/database/kysely/types';
import type { FieldZoneFilters, FieldZoneListInput } from './dto';

type FieldZoneQuery = SelectQueryBuilder<Database, 'field_zones', object>;

export function fieldZoneKyselyFilters(filter?: FieldZoneFilters) {
  return (qb: FieldZoneQuery): FieldZoneQuery => {
    if (!filter) return qb;

    let q = qb;

    if (filter.id) {
      q = q.where('id', '=', filter.id);
    }

    // TODO: director sub-filter — needs filter.sub() helper

    return q;
  };
}

export function fieldZoneKyselySorters(
  input: Pick<FieldZoneListInput, 'sort' | 'order'>,
) {
  return (qb: FieldZoneQuery): FieldZoneQuery => {
    const dir = input.order === 'DESC' ? 'desc' : 'asc';

    switch (input.sort) {
      case 'createdAt':
        return qb.orderBy('created_at', dir);
      case 'name':
      default:
        return qb.orderBy('name', dir);
    }
  };
}

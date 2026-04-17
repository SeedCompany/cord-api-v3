import { type SelectQueryBuilder, sql, type SqlBool } from 'kysely';
import type { Database } from '~/core/database/kysely/types';
import type { FieldRegionFilters, FieldRegionListInput } from './dto';

type FieldRegionQuery = SelectQueryBuilder<Database, 'field_regions', object>;

/**
 * Applies FieldRegionFilters to a Kysely query.
 *
 * Currently supports: id, name (full-text).
 * Sub-filter delegation (director, fieldZone) is a follow-up once
 * the filter.define() / filter.sub() helper is built for Kysely.
 */
export function fieldRegionKyselyFilters(filter?: FieldRegionFilters) {
  return (qb: FieldRegionQuery): FieldRegionQuery => {
    if (!filter) return qb;

    let q = qb;

    if (filter.id) {
      q = q.where('id', '=', filter.id);
    }

    if (filter.name) {
      q = q.where(
        sql<SqlBool>`to_tsvector('english', name) @@ plainto_tsquery('english', ${filter.name})`,
      );
    }

    // TODO: director sub-filter — needs filter.sub() helper
    // TODO: fieldZone sub-filter — needs filter.sub() helper

    return q;
  };
}

/**
 * Applies sort order from FieldRegionListInput.
 * Defaults to name ASC.
 */
export function fieldRegionKyselySorters(
  input: Pick<FieldRegionListInput, 'sort' | 'order'>,
) {
  return (qb: FieldRegionQuery): FieldRegionQuery => {
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

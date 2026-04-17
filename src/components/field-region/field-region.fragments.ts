// All scalar columns selected for a FieldRegion row.
// Used in every read: readOne, readMany, list.
//
// FieldRegion has no correlated subquery fragments — director and fieldZone
// are FK columns resolved by their own DataLoaders. When migrating domains
// that do have correlated subqueries (Project, Partnership, Engagement),
// fragment functions are added alongside this constant, following this pattern:
//
//   export const someRelationFragment =
//     (eb: ExpressionBuilder<Database, 'field_regions'>) =>
//       eb.selectFrom('related_table as rt')
//         .whereRef('rt.field_region_id', '=', 'node.id')
//         .select([...])
//         .as('relation_name');
export const FIELD_REGION_SCALAR_FIELDS = [
  'id',
  'name',
  'director_id',
  'field_zone_id',
  'created_at',
  'updated_at',
] as const;

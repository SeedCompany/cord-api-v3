import { node, relation } from 'cypher-query-builder';
import { DatabaseService } from '../..';

export async function getOrderBy(sort: string, db: DatabaseService) {
  const query1 = db
    .query()
    .match([
      node('node'),
      relation('out', '', sort),
      node('prop', 'Property', { active: true }),
    ])
    .with('*')
    .raw('RETURN apoc.meta.type(prop.value)');
  const result1 = await query1.first();
  const resultType = result1 ? result1['apoc.meta.type(prop.value)'] : 'NoTYPE';
  let orderQuery = 'prop.value';

  if (resultType === 'STRING') {
    orderQuery = 'LOWER(prop.value)';
  }
  return orderQuery;
}

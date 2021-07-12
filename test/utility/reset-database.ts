/* eslint-disable @seedcompany/no-unused-vars */
import { Connection } from 'cypher-query-builder';

export async function resetDatabase(db: Connection) {
  await deleteAllData(db);
  await removeAllIndexesAndConstraints(db);
}
export async function deleteAllData(db: Connection) {
  // await db
  //   .query()
  //   .raw(
  //     `
  //       call apoc.periodic.iterate("MATCH (n) return n", "DETACH DELETE n", {batchSize:1000})
  //       yield batches, total return batches, total
  //     `
  //   )
  //   .run();
}

export async function removeAllIndexesAndConstraints(db: Connection) {
  // await db
  //   .query()
  //   .raw(
  //     `
  //       call apoc.schema.assert({}, {})
  //     `
  //   )
  //   .run();
}

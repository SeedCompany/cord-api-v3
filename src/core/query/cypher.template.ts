export function searchProperty(
  baseNodeLabel: string,
  identifier: string,
  dataTag: string // the cypher identifier that will be used to uniquly identify this data node in the query, must be unique in query
): string {
  return `
  OPTIONAL MATCH
  (${dataTag}_baseNodes:${baseNodeLabel})-[:DATAHOLDERS]->(${dataTag}_dh:DataHolder {identifier:"${identifier}"})-[:DATA]->(${dataTag}:Data),
  (requestingUser)<-[:MEMBERS]-(:SecurityGroup)-[:PERMISSIONS]->(:Permission{read: true})-[:GRANT]->(${dataTag}_dh)
  `;
}

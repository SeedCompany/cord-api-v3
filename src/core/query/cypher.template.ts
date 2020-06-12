/* eslint-disable */
export function queryData(
  baseNodeLabel: string,
  identifier: string,
  dataTag: string, // the cypher identifier that will be used to uniquly identify this data node in the query, must be unique in query
  orgId?: string,
  filter?: string
): { matchQuery: string; returnQuery: string } {
  let filterQuery = '';
  if (filter) {
    filterQuery = ` , value: "${filter}" `;
  }

  let orgQuery = '';
  let orgReturnQuery = '';
  if (orgId) {
    orgQuery = `
    OPTIONAL MATCH

    (:Organization {active: true, id: ${orgId}})
    -[:MEMBERS]->
    (user),

    (${dataTag}_org_baseNodes:${baseNodeLabel})
    -[:DATAHOLDERS]->
    (:DataHolder {active: true, identifier: "${identifier}", isOrgReadable: true})
    -[:DATA]->
    (${dataTag}_org_data:Data {active: true ${filterQuery} })
    `;

    orgReturnQuery = ` , ${dataTag}_org_data.value `;
  }

  const matchQuery = `

  OPTIONAL MATCH

    (${dataTag}_baseNodes:${baseNodeLabel})
    -[:DATAHOLDERS]->
    (${dataTag}_dh:DataHolder {active: true, identifier:"${identifier}"})
    -[:DATA]->
    (${dataTag}_read:Data),

    (requestingUser)
    <-[:MEMBERS]-
    (:SecurityGroup)
    -[:PERMISSIONS]->
    (:Permission{read: true})
    -[:GRANT]->
    (${dataTag}_dh)

    OPTIONAL MATCH

    (user)
    <-[isAdmin:ADMINS]-
    (${dataTag}_admins_baseNodes:${baseNodeLabel})
    -[:DATAHOLDERS]->
    (:DataHolder {active: true, identifier: "${identifier}"})
    -[:DATA]->
    (${dataTag}_admins_data:Data {active: true ${filterQuery} })

    OPTIONAL MATCH

    (${dataTag}_public_baseNodes:${baseNodeLabel})
    -[:DATAHOLDERS]->
    (:DataHolder {active: true, identifier: "${identifier}", isPublicReadable: true})
    -[:DATA]->
    (${dataTag}_public_data:Data {active: true ${filterQuery} })

    ${orgQuery}

  `;

  const returnQuery = `
  ${identifier}: {
    value: coalesce(${dataTag}_read.value, ${dataTag}_admins_data.value, ${dataTag}_public_data.value ${orgReturnQuery})
  } 
  `;

  return {
    matchQuery,
    returnQuery,
  };
}

export function returnDomainObject() {}

export function returnPropertyPortion() {}

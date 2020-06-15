/* eslint-disable */

export function queryData(
  baseNodeLabel: string,
  identifier: string,
  dataTag: string, // the cypher identifier that will be used to uniquly identify this data node in the query, must be unique in query
  addIdAndCreatedAt: boolean,
  orgId?: string,
  filter?: string,
  childBaseLabel?: string,
  childPropIdentifier?: string
): { matchQuery: string; returnQuery: string } {
  let filterQuery = '';
  if (filter) {
    filterQuery = ` , value: "${filter}" `;
  }

  let childNodeQuery = '';
  if (childBaseLabel) {
    childNodeQuery = `
        -[:DATA]->
        (${dataTag}_childBaseNode:${childBaseLabel} {active: true)
        -[:DATAHOLDERS]->
        (${dataTag}_childDh:DataHolder {active: true, identifier:"${childPropIdentifier}"})
      `;
  }

  let orgQuery = '';
  let orgReturnQuery = '';
  let orgBaseNodeIdReturn = '';
  let orgBaseNodeCreatedAtReturn = '';
  if (orgId) {
    orgQuery = `
    OPTIONAL MATCH

    (:Organization {active: true, id: ${orgId}})
    -[:MEMBERS]->
    (user),

    (${dataTag}_org_baseNodes:${baseNodeLabel})
    -[:DATAHOLDERS]->
    (:DataHolder {active: true, identifier: "${identifier}", isOrgReadable: true})
    ${childNodeQuery}
    -[:DATA]->
    (${dataTag}_org_data:Data {active: true ${filterQuery} })
    `;

    orgReturnQuery = ` , ${dataTag}_org_data.value `;

    orgBaseNodeIdReturn = `, ${dataTag}_org_baseNodes.id`;
    orgBaseNodeCreatedAtReturn = `, ${dataTag}_org_baseNodes.createdAt`;
  }

  const matchQuery = `

  OPTIONAL MATCH

    (${dataTag}_baseNodes:${baseNodeLabel})
    -[:DATAHOLDERS]->
    (${dataTag}_dh:DataHolder {active: true, identifier:"${identifier}"})
    ${childNodeQuery}
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
    ${childNodeQuery}
    -[:DATA]->
    (${dataTag}_admins_data:Data {active: true ${filterQuery} })

    OPTIONAL MATCH

    (${dataTag}_public_baseNodes:${baseNodeLabel})
    -[:DATAHOLDERS]->
    (:DataHolder {active: true, identifier: "${identifier}", isPublicReadable: true})
    ${childNodeQuery}
    -[:DATA]->
    (${dataTag}_public_data:Data {active: true ${filterQuery} })

    ${orgQuery}

  `;

  let idAndCreatedAt = ``;
  if (addIdAndCreatedAt) {
    idAndCreatedAt = `
      id: coalesce(
        ${dataTag}_baseNodes.id, 
        ${dataTag}_admins_baseNodes.id, 
        ${dataTag}_public_baseNodes.id
        ${orgBaseNodeIdReturn}
      ),
      createdAt: coalesce(
        ${dataTag}_baseNodes.createdAt, 
        ${dataTag}_admins_baseNodes.createdAt, 
        ${dataTag}_public_baseNodes.createdAt
        ${orgBaseNodeCreatedAtReturn}
      ),
    `;
  }

  const returnQuery = `

  ${idAndCreatedAt}

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

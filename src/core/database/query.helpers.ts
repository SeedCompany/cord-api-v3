import { node, Query, relation } from 'cypher-query-builder';

export function tryGetEditPerm(
  property: string,
  cypherIdentifierForBaseNode: string
) {
  const perm = property + 'EditPerm';
  return [
    [
      node('requestingUser'),
      relation('in', '', 'member'),
      node('', 'SecurityGroup', {
        active: true,
      }),
      relation('out', '', 'permission', { active: true }),
      node(perm, 'Permission', {
        property,
        edit: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node(cypherIdentifierForBaseNode),
    ],
  ];
}

export function addPropertyCoalesceWithClause(property: string) {
  return `
    {
      value: coalesce(${property}.value, null),
      canRead: coalesce(${property}ReadPerm.read, false),
      canEdit: coalesce(${property}EditPerm.edit, false)
    } as ${property}
  `;
}

export function matchProperty(
  query: Query,
  cypherIdentifierForBaseNode: string,
  ...names: string[]
) {
  for (const name of names) {
    query
      .optionalMatch(property(name, cypherIdentifierForBaseNode))
      .optionalMatch(tryGetEditPerm(name, cypherIdentifierForBaseNode));
  }
}

export function property(
  property: string,
  cypherIdentifierForBaseNode: string
) {
  const perm = property + 'ReadPerm';
  return [
    [
      node('requestingUser'),
      relation('in', '', 'member'),
      node('', 'SecurityGroup', {
        active: true,
      }),
      relation('out', '', 'permission', { active: true }),
      node(perm, 'Permission', {
        property,
        read: true,
        active: true,
      }),
      relation('out', '', 'baseNode'),
      node(cypherIdentifierForBaseNode),
      relation('out', '', property, { active: true }),
      node(property, 'Property', { active: true }),
    ],
  ];
}

// export function createPropertyWithSecurityGroup(
//   property: string,
//   additionalLabel: string,
//   addToAdmin: boolean,
//   addToWriter: boolean,
//   addToReader: boolean
// ) {
//   return [
//     node(''), //
//   ];
// }

import { node, Query, relation } from 'cypher-query-builder';

export function tryGetEditPerm(property: string) {
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
      node('user'),
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

export function matchProperty(query: Query, ...names: string[]) {
  for (const name of names) {
    query.optionalMatch(property(name)).optionalMatch(tryGetEditPerm(name));
  }
}

export function property(property: string) {
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
      node('user'),
      relation('out', '', property, { active: true }),
      node(property, 'Property', { active: true }),
    ],
  ];
}

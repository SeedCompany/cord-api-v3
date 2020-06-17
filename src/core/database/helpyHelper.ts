import { node, relation } from 'cypher-query-builder';

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
    coalesce(${property}.value) as ${property}Value,
    coalesce(${property}ReadPerm.read) as ${property}Read,
    coalesce(${property}EditPerm.edit) as ${property}Edit
  `;
}

export function addPropertyReturnClause(property: string) {
  return `
    ${property}Value,
    ${property}Read,
    ${property}Edit
  `;
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

import type { Node } from 'cypher-query-builder';
import { groupBy, mapValues, pickBy } from 'lodash';

/**
 * The shape of a DB permission node's properties
 */
export interface PermissionNode<Key extends string = string> {
  property: Key;
  active: boolean;
  admin: boolean;
  edit: boolean;
  read: boolean;
}

export const permissionDefaults = {
  canRead: false,
  canEdit: false,
};
export type Permission = typeof permissionDefaults;

/**
 * A list of permission nodes whose `property` value is a key of T
 */
export type PermListDbResult<DbProps extends Record<string, any>> = Array<
  Node<PermissionNode<keyof DbProps & string>>
>;

/**
 * Parse a list of permission nodes (from DB) to an object.
 * The object's keys are the unique property names.
 * The object's values are an object of canRead/canEdit which take the most
 * permissive (true) values of the matching permission nodes.
 */
export function parsePermissions<DbProps extends Record<string, any>>(
  permNodes: PermListDbResult<DbProps>
): { [Key in keyof DbProps]?: Permission } {
  // Grab the properties of the neo4j nodes
  const permPropList = permNodes.map((node) => node.properties);
  // Group them by their property key
  const byProp = groupBy(permPropList, 'property');
  // Merge together the results of each property
  const permissions = mapValues(
    byProp,
    (nodes): Permission => {
      const possibilities = nodes.map((node) =>
        // Convert the db properties to API properties.
        // Only keep true values, so merging the objects doesn't replace a true with false
        pickBy({
          canRead: node.read || null,
          canEdit: node.edit || null,
        })
      );
      // Merge the all the true permissions together, otherwise default to false
      return Object.assign({}, permissionDefaults, ...possibilities);
    }
  );

  return permissions;
}

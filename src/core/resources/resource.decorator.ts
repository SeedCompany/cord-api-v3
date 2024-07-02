import { EnhancedResource, ResourceShape } from '~/common';
import type { $ } from '../edgedb';
import { __privateDontUseThis } from './resource-map-holder';

/**
 * Register a resource for dynamic usage across the codebase.
 * Be sure to add the type to the type map as well.
 * See {@link import('./map').ResourceMap} for details on that.
 */
export const RegisterResource = ({
  db,
  skipAccessPolicies,
}: {
  db?: $.$expr_PathNode;
  skipAccessPolicies?: boolean;
} = {}) => {
  return <T extends ResourceShape<any>>(target: T) => {
    __privateDontUseThis[target.name] = target;
    if (db) {
      EnhancedResource.dbTypes.set(target, db);
      if (skipAccessPolicies) {
        EnhancedResource.dbSkipAccessPolicies.add(db.__element__.__name__);
      }
    }
    return target;
  };
};

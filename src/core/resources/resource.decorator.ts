import { ResourceShape } from '~/common';
import { __privateDontUseThis } from './resource-map-holder';

/**
 * Register a resource for dynamic usage across the codebase.
 * Be sure to add the type to the type map as well.
 * See {@link import('./map').ResourceMap} for details on that.
 */
export const RegisterResource = () => {
  return <T extends ResourceShape<any>>(target: T) => {
    __privateDontUseThis[target.name] = target;
    return target;
  };
};

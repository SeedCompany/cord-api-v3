import { compact, last, lowerCase, startCase } from 'lodash';
import {
  isSecured,
  keys,
  ResourceShape,
  Session,
  UnauthorizedException,
} from '~/common';
import { ChangesOf, isRelation } from '~/core/database/changes';
import { Action } from '../builder/perm-granter';
import { ResourceProps } from '../builder/prop-granter';
import { PolicyExecutor } from './policy-executor';

export class ResourcePrivileges<TResourceStatic extends ResourceShape<any>> {
  constructor(
    private readonly resource: TResourceStatic,
    private readonly object: TResourceStatic['prototype'] | undefined,
    private readonly session: Session,
    private readonly policyExecutor: PolicyExecutor
  ) {}

  can(action: Action, prop?: ResourceProps<TResourceStatic>) {
    return this.policyExecutor.execute(
      action,
      this.session,
      this.resource,
      this.object,
      prop
    );
  }

  verifyCan(action: Action, prop?: ResourceProps<TResourceStatic>) {
    if (!this.can(action, prop)) {
      throw new UnauthorizedException(
        `You do not have the permission to ${action} ${
          this.object ? 'this' : 'any'
        } ${lowerCase(this.resource.name)}${prop ? '.' + prop : ''}`
      );
    }
  }

  /**
   * Verifies the current user can make the changes specified to the given object.
   */
  verifyChanges(
    changes: ChangesOf<TResourceStatic['prototype']>,
    { pathPrefix: pathPrefixProp }: { pathPrefix?: string | null } = {}
  ) {
    if (!this.object) {
      throw new Error('Current object is required to verify changes');
    }

    const pathPrefix =
      pathPrefixProp ?? pathPrefixProp === null
        ? null
        : // Guess the input field path based on name convention
          last(startCase(this.resource.name).split(' '))!.toLowerCase();

    for (const prop of keys(changes)) {
      const dtoPropName = isRelation(prop, this.object)
        ? prop.slice(0, -2)
        : prop;
      const dtoProp = this.object[dtoPropName];
      if (!isSecured(dtoProp) || dtoProp.canEdit) {
        continue;
      }
      const fullPath = compact([pathPrefix, prop]).join('.');
      throw new UnauthorizedException(
        `You do not have permission to update ${this.resource.name}.${prop}`,
        fullPath
      );
    }
  }
}

import { LazyGetter as Once } from 'lazy-get-decorator';
import { compact, last, lowerCase, startCase } from 'lodash';
import {
  isSecured,
  keys,
  mapFromList,
  ResourceShape,
  SecuredResource,
  SecuredResourceKey,
  Session,
  UnauthorizedException,
} from '~/common';
import { ChangesOf, isRelation } from '~/core/database/changes';
import { DbPropsOfDto } from '~/core/database/results';
import { Action } from '../builder/perm-granter';
import {
  AllPermissionsView,
  createAllPermissionsView,
} from './all-permissions-view';
import { PolicyExecutor } from './policy-executor';

export class ResourcePrivileges<TResourceStatic extends ResourceShape<any>> {
  constructor(
    private readonly resource: TResourceStatic,
    private readonly object: TResourceStatic['prototype'] | undefined,
    private readonly session: Session,
    private readonly policyExecutor: PolicyExecutor
  ) {}

  can(action: Action, prop?: SecuredResourceKey<TResourceStatic>) {
    return this.policyExecutor.execute(
      action,
      this.session,
      this.resource,
      this.object,
      prop
    );
  }

  verifyCan(action: Action, prop?: SecuredResourceKey<TResourceStatic>) {
    if (!this.can(action, prop)) {
      throw new UnauthorizedException(
        `You do not have the permission to ${action} ${
          this.object ? 'this' : 'any'
        } ${lowerCase(this.resource.name)}${prop ? '.' + prop : ''}`
      );
    }
  }

  /**
   * An alternative view that gives an object with all the permissions for
   * each property & relation.
   * @example
   * const privileges = Privileges.for(session, User);
   * if (privileges.all.email.read) {
   *   // can read
   * }
   */
  @Once()
  get all(): AllPermissionsView<TResourceStatic> {
    return createAllPermissionsView(this.resource, this);
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

  /**
   * Takes the given dto which has unsecured props and returns the props that
   * are supposed to be secured (unsecured props are omitted) as secured.
   *
   * This is mainly here to service the existing codebase. I suspect we'll want
   * to migrate to a different method that handles things in a slightly different way.
   */
  secureProps(
    dto: DbPropsOfDto<TResourceStatic['prototype']>
  ): SecuredResource<TResourceStatic, false> {
    const keys = this.resource.SecuredProps as Array<
      SecuredResourceKey<TResourceStatic>
    >;
    const securedProps = mapFromList(keys, (key) => {
      const canRead = this.can('read', key);
      const canEdit = this.can('edit', key);
      let value = (dto as any)[key];
      value = canRead ? value : Array.isArray(value) ? [] : undefined;
      return [key, { value, canRead, canEdit }];
    });
    return securedProps as SecuredResource<TResourceStatic, false>;
  }
}

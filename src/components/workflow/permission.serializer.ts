import { setOf } from '@seedcompany/common';
import { type ID, Role } from '~/common';
import { type Identity } from '~/core/authentication';
import { type Privileges, type UserResourcePrivileges } from '../authorization';
import { Condition } from '../authorization/policy/conditions';
import { type Workflow } from './define-workflow';
import { type SerializedWorkflowTransitionPermission as SerializedTransitionPermission } from './dto/serialized-workflow.dto';
import { TransitionCondition } from './workflow.granter';

export const transitionPermissionSerializer =
  <W extends Workflow>(
    workflow: W,
    privileges: Privileges,
    identity: Identity,
  ) =>
  (transition: W['transition']): readonly SerializedTransitionPermission[] => {
    const all = [...Role].flatMap((role) => {
      return identity.asRole(role, () => {
        const p = privileges.for(workflow.eventResource);
        const readEvent = resolve(p, 'read', transition.key);
        const execute = resolve(p, 'create', transition.key);
        return [
          {
            role,
            readEvent: readEvent !== false,
            condition: renderCondition(readEvent),
          },
          {
            role,
            execute: execute !== false,
            condition: renderCondition(execute),
          },
        ];
      });
    });

    // Remove roles that are never applicable.
    const applicableRoles = setOf(
      all.flatMap((p) => (p.readEvent || p.execute ? p.role : [])),
    );
    return all.filter((p) => applicableRoles.has(p.role));
  };

const resolve = (
  p: UserResourcePrivileges<any>,
  action: string,
  transitionKey: ID,
) =>
  p.resolve({
    action,
    optimizeConditions: true,
    conditionResolver: (condition) =>
      condition instanceof TransitionCondition
        ? condition.allowedTransitionKeys.has(transitionKey)
        : undefined,
  });

const renderCondition = (c: boolean | Condition) =>
  typeof c === 'boolean' ? undefined : Condition.id(c);

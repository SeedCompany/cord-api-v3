import { setOf } from '@seedcompany/common';
import { DateTime } from 'luxon';
import { ID, Role, Session } from '~/common';
import { Privileges, UserResourcePrivileges } from '../authorization';
import { Condition } from '../authorization/policy/conditions';
import { Workflow } from './define-workflow';
import { SerializedWorkflowTransitionPermission as SerializedTransitionPermission } from './dto/serialized-workflow.dto';
import { TransitionCondition } from './workflow.granter';

export const transitionPermissionSerializer =
  <W extends Workflow>(workflow: W, privileges: Privileges) =>
  (transition: W['transition']): readonly SerializedTransitionPermission[] => {
    const all = [...Role].flatMap((role) => {
      const session: Session = {
        token: 'system',
        issuedAt: DateTime.now(),
        userId: 'anonymous' as ID,
        anonymous: false,
        roles: [`global:${role}`],
      };
      const p = privileges.for(session, workflow.eventResource);
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

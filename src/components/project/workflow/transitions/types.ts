import { mapValues } from '@seedcompany/common';
import { Merge } from 'type-fest';
import * as uuid from 'uuid';
import { ID, Many, maybeMany, Role } from '~/common';
import { ProjectStep as Step } from '../../dto';
import { ProjectWorkflowTransition as PublicTransition } from '../dto/workflow-transition.dto';
import { TransitionCondition } from './conditions';
import type { TransitionName } from './project-transitions';

const PROJECT_TRANSITION_NAMESPACE = '8297b9a1-b50b-4ec9-9021-a0347424b3ec';

export type TransitionInput = Merge<
  PublicTransition,
  {
    id?: ID | string;
    from?: Many<Step>;
    conditions?: Many<TransitionCondition>;
    notify?: {
      /**
       * Notify project members with these roles, e.g. [Role.Marketing]
       */
      membersWithRoles?: readonly Role[];
    };
  }
>;

export interface InternalTransition extends PublicTransition {
  name: TransitionName;
  from?: readonly Step[];
  conditions?: readonly TransitionCondition[];
  notify?: {
    /**
     * Notify project members with these roles, e.g. [Role.Marketing]
     */
    membersWithRoles?: readonly Role[];
  };
}

export const defineTransitions = <Names extends string>(
  obj: Record<Names, TransitionInput>,
) =>
  mapValues(
    obj,
    (name, transition): InternalTransition => ({
      name: name as TransitionName,
      ...transition,
      from: maybeMany(transition.from),
      id: (transition.id ?? hashId(name)) as ID,
      conditions: maybeMany(transition.conditions),
    }),
  ).asRecord;

function hashId(name: string) {
  return uuid.v5(name, PROJECT_TRANSITION_NAMESPACE);
}

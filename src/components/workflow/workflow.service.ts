import { Inject, Injectable } from '@nestjs/common';
import { entries, Nil } from '@seedcompany/common';
import {
  ID,
  MadeEnum,
  ResourceShape,
  Session,
  UnauthorizedException,
} from '~/common';
import { Privileges } from '../authorization';
import {
  ExecuteTransitionInput as ExecuteTransitionInputFn,
  WorkflowEvent as WorkflowEventFn,
} from './dto';
import { InternalTransition } from './transitions';

type ExecuteTransitionInput = ReturnType<
  typeof ExecuteTransitionInputFn
>['prototype'];
type WorkflowEvent = ReturnType<typeof WorkflowEventFn>['prototype'];

export const WorkflowService = <
  State extends string,
  Names extends string,
  Context,
  EventClass extends ResourceShape<WorkflowEvent>,
>(
  stateEnum: MadeEnum<State>,
  transitionMap: Record<Names, InternalTransition<State, Names, Context>>,
  eventResource: EventClass,
) => {
  @Injectable()
  abstract class WorkflowServiceClass {
    @Inject() protected readonly privileges: Privileges;
    protected readonly transitions = entries(transitionMap).map(([_, t]) => t);

    protected transitionByKey(
      key: ID | Nil,
      to: State,
    ):
      | (Omit<InternalTransition<State, Names, Context>, 'to'> & {
          to: State;
        })
      | null {
      if (!key) {
        return null;
      }
      const t = this.transitions.find((t) => t.key === key);
      if (!t) {
        return null;
      }
      return { ...t, to };
    }

    protected async resolveAvailable(
      currentState: State,
      dynamicContext: Context,
      session: Session,
    ) {
      let available = this.transitions;

      // Filter out non applicable transitions
      available = available.filter((t) =>
        t.from ? t.from.has(currentState) : true,
      );

      // Filter out transitions without authorization to execute
      const p = this.privileges.for(session, eventResource);
      available = available.filter((t) =>
        // I don't have a good way to type this right now.
        // Context usage is still fuzzy when conditions need different shapes.
        p.forContext({ transition: t.key } as any).can('create'),
      );

      // Resolve conditions & filter as needed
      const conditions = available.flatMap((t) => t.conditions ?? []);
      const resolvedConditions = new Map(
        await Promise.all(
          [...new Set(conditions)].map(
            async (condition) =>
              [condition, await condition.resolve(dynamicContext)] as const,
          ),
        ),
      );
      available = available.flatMap((t) => {
        const conditions =
          t.conditions?.map((c) => resolvedConditions.get(c)!) ?? [];
        if (conditions.some((c) => c.status === 'OMIT')) {
          return [];
        }
        if (conditions.every((c) => c.status === 'ENABLED')) {
          return t;
        }
        const disabledReasons = conditions.flatMap((c) =>
          c.status === 'DISABLED' ? c.disabledReason ?? [] : [],
        );
        return {
          ...t,
          disabled: true,
          disabledReason: disabledReasons.join('\n'), // TODO split to list
        };
      });

      // Resolve dynamic to steps
      const dynamicTos = available.flatMap((t) =>
        typeof t.to !== 'string' ? t.to : [],
      );
      const resolvedTos = new Map(
        await Promise.all(
          dynamicTos.map(async (to) => {
            return [to, await to.resolve(dynamicContext)] as const;
          }),
        ),
      );
      return available.map((t) => ({
        ...t,
        to: typeof t.to !== 'string' ? resolvedTos.get(t.to)! : t.to,
      }));
    }

    canBypass(session: Session) {
      return this.privileges.for(session, eventResource).can('create');
    }

    protected getBypassIfValid(
      input: ExecuteTransitionInput,
      session: Session,
    ): State | undefined {
      if (!input.bypassTo) {
        return undefined;
      }
      if (!this.canBypass(session)) {
        throw new UnauthorizedException(
          'You do not have permission to bypass workflow. Specify a transition instead.',
        );
      }
      return input.bypassTo;
    }
  }

  return WorkflowServiceClass;
};

export const findTransition = <T extends { key: ID }>(
  transitions: readonly T[],
  needle: ExecuteTransitionInput['transition'],
) => {
  const transition = transitions.find((t) => t.key === needle);
  if (!transition) {
    throw new UnauthorizedException('This transition is not available');
  }
  return transition;
};

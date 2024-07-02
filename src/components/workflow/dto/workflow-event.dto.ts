import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  DateTimeField,
  ID,
  IdField,
  MadeEnum,
  Secured,
  SecuredRichTextNullable,
  SetUnsecuredType,
} from '~/common';
import { LinkTo } from '~/core/resources';
import type { InternalTransition } from '../transitions';
import { WorkflowTransition } from './workflow-transition.dto';

export function WorkflowEvent<State extends string>(
  state: MadeEnum<State>,
  transitionType: ReturnType<typeof WorkflowTransition>,
) {
  @ObjectType({ isAbstract: true })
  abstract class WorkflowEventClass {
    @IdField()
    readonly id: ID;

    readonly who: Secured<LinkTo<'User'>>;

    @DateTimeField()
    readonly at: DateTime;

    @Field(() => transitionType, {
      nullable: true,
      description: 'The transition taken, null if workflow was bypassed',
    })
    readonly transition:
      | (InternalTransition<State, string, any> & SetUnsecuredType<ID | null>)
      | null;

    // TODO maybe add `from`?

    @Field(() => state as object)
    readonly to: State;

    @Field()
    readonly notes: SecuredRichTextNullable;
  }
  return WorkflowEventClass;
}
WorkflowEvent.BaseNodeProps = ['id', 'createdAt', 'step', 'transition'];

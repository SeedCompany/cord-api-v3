import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps, SecuredString } from '../../../common';
import { SecuredPlanChangeStatus } from './plan-change-status.enum';
import { SecuredPlanChangeTypes } from './plan-change-type.enum';

@InterfaceType({
  implements: [Resource],
})
export class Changeset extends Resource {}

@ObjectType({
  implements: [Changeset, Resource],
})
export abstract class PlanChange extends Resource implements Changeset {
  static readonly Props = keysOf<PlanChange>();
  static readonly SecuredProps = keysOf<SecuredProps<PlanChange>>();

  @Field()
  readonly types: SecuredPlanChangeTypes;

  @Field()
  readonly summary: SecuredString;

  @Field()
  readonly status: SecuredPlanChangeStatus;
}

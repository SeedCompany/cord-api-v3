import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps, SecuredString } from '../../../../common';
import { SecuredPlanChangeStatus } from './plan-change-status.enum';
import { SecuredPlanChangeTypes } from './plan-change-type.enum';

@ObjectType({
  implements: [Resource],
})
export abstract class PlanChange extends Resource {
  static readonly Props = keysOf<PlanChange>();
  static readonly SecuredProps = keysOf<SecuredProps<PlanChange>>();

  @Field()
  readonly types: SecuredPlanChangeTypes;

  @Field()
  readonly summary: SecuredString;

  @Field()
  readonly status: SecuredPlanChangeStatus;
}

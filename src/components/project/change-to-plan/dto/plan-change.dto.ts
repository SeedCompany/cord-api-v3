import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  SecuredEnum,
  SecuredEnumList,
  SecuredProps,
  SecuredString,
} from '../../../../common';
import { PlanChangeStatus } from './plan-change-status.enum';
import { PlanChangeType } from './plan-change-type.enum';

@ObjectType({
  description: SecuredEnum.descriptionFor('a planChange status'),
})
export abstract class SecuredPlanChangeStatus extends SecuredEnum(
  PlanChangeStatus
) {}

@ObjectType({
  description: SecuredEnumList.descriptionFor('planChange types'),
})
export abstract class SecuredPlanChangeTypes extends SecuredEnumList(
  PlanChangeType
) {}

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

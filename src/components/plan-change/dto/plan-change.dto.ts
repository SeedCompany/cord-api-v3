import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps, SecuredString } from '../../../common';
import { Changeset } from '../../changeset/dto';
import { SecuredPlanChangeStatus } from './plan-change-status.enum';
import { SecuredPlanChangeTypes } from './plan-change-type.enum';

@ObjectType({
  implements: [Changeset, Resource],
})
export abstract class PlanChange extends Resource implements Changeset {
  static readonly Props = keysOf<PlanChange>();
  static readonly SecuredProps = keysOf<SecuredProps<PlanChange>>();
  __typename: 'PlanChange';

  @Field()
  readonly types: SecuredPlanChangeTypes;

  @Field()
  readonly summary: SecuredString;

  @Field()
  readonly status: SecuredPlanChangeStatus;
}

import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps, SecuredString } from '../../../../common';
import { PlanChange } from '../../change-to-plan/dto/plan-change.dto';

@ObjectType({
  implements: [Resource],
})
export class Property extends Resource {
  static readonly Props = keysOf<Property>();
  static readonly SecuredProps = keysOf<SecuredProps<Property>>();
  static readonly Relations = {
    change: [PlanChange],
  };

  @Field()
  readonly value: SecuredString;
}

import { Field, ObjectType } from 'type-graphql';
import { Resource, SecuredBoolean, SecuredDate } from '../../../common';
import { CeremonyType } from './type.enum';

@ObjectType({
  implements: [Resource],
})
export class Ceremony extends Resource {
  @Field(() => CeremonyType)
  readonly type: CeremonyType;

  @Field()
  readonly planned: SecuredBoolean;

  @Field()
  readonly estimatedDate: SecuredDate;

  @Field()
  readonly actualDate: SecuredDate;
}

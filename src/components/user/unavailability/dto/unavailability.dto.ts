import { Field, ObjectType } from '@nestjs/graphql';
import {
  DateTimeField,
  Resource,
  SecuredDateTime,
  SecuredKeys,
  SecuredString,
} from '../../../../common';

@ObjectType({
  implements: [Resource],
})
export class Unavailability extends Resource {
  @Field()
  readonly description: SecuredString;

  @DateTimeField()
  readonly start: SecuredDateTime;

  @DateTimeField()
  readonly end: SecuredDateTime;
}

declare module '../../../authorization/policies/mapping' {
  interface TypeToDto {
    Unavailability: Unavailability;
  }
  interface TypeToSecuredProps {
    Unavailability: SecuredKeys<Unavailability>;
  }
}

import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredDateTime, SecuredString } from '~/common';
import { RegisterResource } from '~/core/resources';

@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class Unavailability extends Resource {
  static readonly Parent = () => import('../../dto').then((m) => m.User);

  @Field()
  readonly description: SecuredString;

  @Field()
  readonly start: SecuredDateTime;

  @Field()
  readonly end: SecuredDateTime;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Unavailability: typeof Unavailability;
  }
}

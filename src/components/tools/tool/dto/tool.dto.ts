import { Field, ObjectType } from '@nestjs/graphql';
import {
  DbUnique,
  NameField,
  Resource,
  SecuredBoolean,
  SecuredString,
} from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';

@RegisterResource({ db: e.Tool })
@ObjectType({
  implements: [Resource],
})
export class Tool extends Resource {
  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  @Field()
  readonly aiBased: SecuredBoolean;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Tool: typeof Tool;
  }
  interface ResourceDBMap {
    Tool: typeof e.default.Tool;
  }
}

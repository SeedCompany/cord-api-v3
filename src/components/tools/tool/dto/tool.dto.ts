import { Field, ObjectType } from '@nestjs/graphql';
import {
  DbUnique,
  NameField,
  Resource,
  SecuredBoolean,
  SecuredString,
  SecuredStringNullable,
} from '~/common';
import { RegisterResource } from '~/core/resources';
import { SecuredToolKey } from './tool-key.enum';

@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class Tool extends Resource {
  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  @Field()
  readonly description: SecuredStringNullable;

  @Field()
  readonly aiBased: SecuredBoolean;

  @Field({
    description: 'A stable machine identifier for known tools',
    nullable: true,
  })
  readonly key: SecuredToolKey;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Tool: typeof Tool;
  }
}

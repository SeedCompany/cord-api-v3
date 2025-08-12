import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  type Secured,
  SecuredDateNullable,
  SecuredProperty,
} from '~/common';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';

@RegisterResource({ db: e.Tool.Usage })
@ObjectType({
  implements: [Resource],
})
export class ToolUsage extends Resource {
  static readonly Parent = 'dynamic';

  readonly container: Secured<LinkTo<'Resource'>>;
  readonly tool: Secured<LinkTo<'Tool'>>;

  @Field()
  readonly startDate: SecuredDateNullable;
}

@ObjectType()
export class SecuredToolUsage extends SecuredProperty(ToolUsage) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ToolUsage: typeof ToolUsage;
  }
  interface ResourceDBMap {
    ToolUsage: typeof e.Tool.Usage;
  }
}

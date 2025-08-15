import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  type Secured,
  SecuredDateNullable,
  type SetUnsecuredType,
  type UnsecuredDto,
} from '~/common';
import { type BaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { Tool } from '../../tool/dto';

@RegisterResource({ db: e.Tool.Usage })
@ObjectType({
  implements: [Resource],
})
export class ToolUsage extends Resource {
  static readonly Parent = 'dynamic';

  readonly container: Secured<BaseNode>;

  @Field(() => Tool)
  readonly tool: Tool & SetUnsecuredType<UnsecuredDto<Tool>>;

  @Field()
  readonly startDate: SecuredDateNullable;

  readonly creator: LinkTo<'Actor'>;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ToolUsage: typeof ToolUsage;
  }
  interface ResourceDBMap {
    ToolUsage: typeof e.Tool.Usage;
  }
}

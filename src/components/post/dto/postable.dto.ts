import { InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  type ID,
  IdField,
  Resource,
  type ResourceRelationsShape,
} from '~/common';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { Post } from './post.dto';

@RegisterResource({ db: e.Mixin.Postable })
@InterfaceType({
  description: stripIndent`
    An object that can be used to enable Post discussions on a Node.
  `,
})
export abstract class Postable {
  static readonly Relations = (() => ({
    ...Resource.Relations(),
    posts: [Post],
  })) satisfies ResourceRelationsShape;
  static readonly Parent = 'dynamic';

  @IdField({
    description: "The object's ID",
  })
  readonly id: ID;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Postable: typeof Postable;
  }
  interface ResourceDBMap {
    Postable: typeof e.Mixin.Postable;
  }
}

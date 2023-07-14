import { InterfaceType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, IdField, ResourceRelationsShape, SecuredProps } from '~/common';
import { RegisterResource } from '~/core/resources';
import { Post } from './post.dto';

@RegisterResource()
@InterfaceType({
  description: stripIndent`
    An object that can be used to enable Post discussions on a Node.
  `,
})
export abstract class Postable {
  static readonly Props: string[] = keysOf<Postable>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Postable>>();
  static readonly Relations = {
    posts: [Post],
  } satisfies ResourceRelationsShape;
  static readonly Parent = 'dynamic';

  readonly __typename: string;

  @IdField({
    description: "The object's ID",
  })
  readonly id: ID;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Postable: typeof Postable;
  }
}

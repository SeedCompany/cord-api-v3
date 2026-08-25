import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateTimeField, Resource, type Secured, SecuredString } from '~/common';
import { e } from '~/core/gel';
import { type BaseNode } from '~/core/neo4j/results';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { PostType } from './post-type.enum';
import {
  narrowestOf,
  PostShareability,
  SecuredPostShareability,
} from './shareability.dto';

@RegisterResource({ db: e.Post })
@ObjectType({
  implements: [Resource],
})
export class Post extends Resource {
  static readonly Parent = 'dynamic';

  readonly parent: BaseNode;

  readonly creator: Secured<LinkTo<'User'>>;

  @Field(() => PostType)
  readonly type: PostType;

  @Field(() => PostShareability, {
    description: `
      How widely the author asked for this to be shared.

      This is the *request*, not the outcome — see \`approvedShareability\` and
      \`effectiveShareability\`.
    `,
  })
  readonly shareability: PostShareability;

  @Field({
    description: `
      How widely a moderator has cleared this to be shared, or null if it has
      not been reviewed.

      Null is distinct from a review that deliberately narrowed the reach: the
      first means "nobody has looked", the second means "someone looked and said
      Internal".

      Secured rather than plain, because \`canEdit\` on this field is exactly the
      question "may I moderate this post?" — the UI reads it to decide whether
      to offer the control, and the service reads it to authorize the mutation.
    `,
  })
  readonly approvedShareability: SecuredPostShareability;

  readonly approvedBy: Secured<LinkTo<'User'> | null>;

  @DateTimeField({ nullable: true })
  readonly approvedAt: DateTime | null;

  /**
   * The quarterly report this was submitted with, if any.
   *
   * Optional on purpose. A prayer request lives on its engagement and acquires a
   * report when someone includes it in that quarter's report, so this is
   * attribution rather than ownership — losing the report must not lose the post.
   */
  readonly report: Secured<LinkTo<'PeriodicReport'> | null>;

  /**
   * The post this one updates, if any — an answer to an earlier prayer request,
   * for instance. Lets a request and its updates be read together instead of as
   * separate undated entries.
   */
  readonly respondsTo: Secured<LinkTo<'Post'> | null>;

  @Field()
  readonly body: SecuredString;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

/**
 * How widely this post may actually be shared right now.
 *
 * An unreviewed post is readable internally but no wider, so moderation never
 * hides anything from staff — it only holds back external reach. Once reviewed,
 * the moderator's decision stands on its own; it is not re-narrowed by the
 * original request, because a moderator is allowed to clear exactly what was
 * asked for.
 */
export const effectiveShareabilityOf = (post: {
  shareability: PostShareability;
  approvedShareability: PostShareability | null;
}): PostShareability =>
  post.approvedShareability ?? narrowestOf(post.shareability, 'Internal');

declare module '~/core/resources/map' {
  interface ResourceMap {
    Post: typeof Post;
  }
  interface ResourceDBMap {
    Post: typeof e.default.Post;
  }
}

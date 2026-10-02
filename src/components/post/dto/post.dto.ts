import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  DateTimeField,
  Resource,
  type Secured,
  SecuredBoolean,
  SecuredString,
  SecuredStringNullable,
} from '~/common';
import { type BaseNode, type LinkTo, RegisterResource } from '~/core/resources';
import { PostType } from './post-type.enum';
import {
  narrowestOf,
  PostShareability,
  SecuredPostShareability,
} from './shareability.dto';

@RegisterResource()
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
      Internal". A post whose requested reach never leaves Seed Company is
      cleared on creation, so only posts that need a human are ever null.

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

  @Field({
    description: `
      What the author actually wrote. Never overwritten by a translation or a
      moderator's edit — see \`finalBody\` and \`effectiveBody\` for those.
    `,
  })
  readonly body: SecuredString;

  @Field({
    description: `
      The wording actually shown once this leaves the author's hands — a
      translation, a moderator's touch-up, or both. Null means \`body\` is
      still the whole story.

      Secured rather than plain, for the same reason as \`approvedShareability\`:
      \`canEdit\` here is the question "may I finalize the wording of this
      post?"
    `,
  })
  readonly finalBody: SecuredStringNullable;

  @Field({
    description: `
      Curated into this quarter's Investor Report — a distinct question from
      \`shareability\`/\`approvedShareability\` (may this leave Seed Company at
      all). Only meaningful once \`report\` is set, and only once the post has
      been cleared to leave Seed Company; at most a few per report.

      Secured for the same reason as \`approvedShareability\`: \`canEdit\` is the
      question "may I curate this into the investor report?"
    `,
  })
  readonly featured: SecuredBoolean;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

/**
 * The wording to actually show anywhere this post's content matters beyond
 * the author's own view — `finalBody` if anyone has produced one, otherwise
 * `body` unchanged. Two columns so the author's original is never lost to
 * someone else's edit; one computed field so most callers never have to think
 * about which one to read.
 */
export const effectiveBodyOf = (post: {
  body: string;
  finalBody: string | null;
}): string => post.finalBody ?? post.body;

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
}

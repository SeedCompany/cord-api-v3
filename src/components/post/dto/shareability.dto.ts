import { ObjectType } from '@nestjs/graphql';
import { type EnumType, makeEnum, SecuredEnum } from '~/common';

export type PostShareability = EnumType<typeof PostShareability>;
export const PostShareability = makeEnum({
  name: 'PostShareability',
  values: [
    { value: 'Membership', label: 'Team Members' },
    {
      value: 'ProjectTeam',
      label: 'Team Members',
      deprecationReason: 'Use `Membership` instead',
    },
    'Internal',
    'AskToShareExternally',
    'External',
  ],
});

@ObjectType({
  description: SecuredEnum.descriptionFor('post shareability'),
})
export abstract class SecuredPostShareability extends SecuredEnum(
  PostShareability,
  { nullable: true },
) {}

/**
 * Reach ordered narrowest to widest.
 *
 * `ProjectTeam` is a deprecated alias for `Membership` and sits at the same
 * rank, so comparisons treat the two as equivalent rather than ordering the
 * alias arbitrarily.
 *
 * Not derived from the enum's declaration order: that order is a schema
 * artifact, and silently re-ranking every comparison here if someone inserts a
 * value would be a nasty way to find out.
 */
const reachRank: Record<PostShareability, number> = {
  Membership: 0,
  ProjectTeam: 0,
  Internal: 1,
  AskToShareExternally: 2,
  External: 3,
};

/** Whether `a` reaches at least as far as `b`. */
export const reachesAtLeast = (a: PostShareability, b: PostShareability) =>
  reachRank[a] >= reachRank[b];

/** Whichever of the two reaches less far. */
export const narrowestOf = (
  a: PostShareability,
  b: PostShareability,
): PostShareability => (reachRank[a] <= reachRank[b] ? a : b);

/**
 * Whether this reach leaves Seed Company, and therefore needs a moderator.
 *
 * `AskToShareExternally` counts. It reads like a deferral, but the moment it
 * defers to happens outside Cord — someone reading a feed and deciding to use
 * an item — where there is nothing left to check. So it is gated here, where
 * there still is.
 */
export const needsModeration = (reach: PostShareability) =>
  reachesAtLeast(reach, 'AskToShareExternally');

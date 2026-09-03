import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { keys } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { type UserUpdate, UserUpdated } from './dto';

@Resolver(UserUpdated)
export class UserUpdatedResolver {
  @ResolveField(() => [String], {
    description: stripIndent`
      A list of keys of the \`UserUpdate\` object which have been updated.

      This can be used to determine which fields have been updated, since
      GQL cannot distinguish between omitted fields and explicit nulls.

      Note that identifying/contact fields — \`email\`, \`phone\`,
      \`realFirstName\`, \`realLastName\`, \`about\` — are reported here when they
      change but are intentionally absent from \`previous\`/\`updated\`.
      Re-read \`user\` to get their values, under your own privileges.
    `,
  })
  updatedKeys(
    @Parent() { updated }: UserUpdated,
  ): ReadonlyArray<keyof UserUpdate> {
    return keys(updated);
  }
}

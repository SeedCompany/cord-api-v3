import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { keys } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { type EngagementUpdate, EngagementUpdated } from './dto';

@Resolver(EngagementUpdated)
export class EngagementUpdatedResolver {
  @ResolveField(() => [String], {
    description: stripIndent`
      A list of keys of the \`EngagementUpdate\` object which have been updated.

      This can be used to determine which fields have been updated, since
      GQL cannot distinguish between omitted fields and explicit nulls.
    `,
  })
  updatedKeys(
    @Parent() { updated }: EngagementUpdated,
  ): ReadonlyArray<keyof EngagementUpdate> {
    return keys(updated);
  }
}

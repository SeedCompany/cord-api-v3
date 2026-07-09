import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { keys } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { type CeremonyUpdate, CeremonyUpdated } from './dto';

@Resolver(CeremonyUpdated)
export class CeremonyUpdatedResolver {
  @ResolveField(() => [String], {
    description: stripIndent`
      A list of keys of the \`CeremonyUpdate\` object which have been updated.

      This can be used to determine which fields have been updated, since
      GQL cannot distinguish between omitted fields and explicit nulls.
    `,
  })
  updatedKeys(
    @Parent() { updated }: CeremonyUpdated,
  ): ReadonlyArray<keyof CeremonyUpdate> {
    return keys(updated);
  }
}

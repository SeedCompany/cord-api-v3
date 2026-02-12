import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { keys } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { type LanguageUpdate, LanguageUpdated } from './dto';

@Resolver(LanguageUpdated)
export class LanguageUpdatedResolver {
  @ResolveField(() => [String], {
    description: stripIndent`
      A list of keys of the \`LanguageUpdate\` object which have been updated.

      This can be used to determine which fields have been updated, since
      GQL cannot distinguish between omitted fields and explicit nulls.
    `,
  })
  updatedKeys(
    @Parent() { updated }: LanguageUpdated,
  ): ReadonlyArray<keyof LanguageUpdate> {
    return keys(updated);
  }
}

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

      Note: these are the *input* fields that were written, not the computed
      fields they affect. In particular the derived \`Language.population\`
      field — which is \`populationOverride\`, falling back to the ethnologue
      population when the override is null — is never listed here.

      To detect a change to the effective \`population\`:
      - if \`populationOverride\` is in this list, it changed; or
      - if \`population\` appears in the nested \`ethnologue\` update AND the
        language's \`populationOverride\` is currently null, the fallback moved.

      The override-is-null check matters: when an override is set, an ethnologue
      population change is reported (under \`ethnologue\`) but does NOT change the
      effective population, since the override still wins. If in doubt, just
      re-read \`Language.population\` — it always reflects the current value.
    `,
  })
  updatedKeys(
    @Parent() { updated }: LanguageUpdated,
  ): ReadonlyArray<keyof LanguageUpdate> {
    return keys(updated);
  }
}

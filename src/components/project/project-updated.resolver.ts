import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { keys } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { type ProjectUpdate, ProjectUpdated } from './dto';

@Resolver(ProjectUpdated)
export class ProjectUpdatedResolver {
  @ResolveField(() => [String], {
    description: stripIndent`
      A list of keys of the \`ProjectUpdate\` object which have been updated.

      This can be used to determine which fields have been updated, since
      GQL cannot distinguish between omitted fields and explicit nulls.
    `,
  })
  updatedKeys(
    @Parent() { updated }: ProjectUpdated,
  ): ReadonlyArray<keyof ProjectUpdate> {
    return keys(updated);
  }
}

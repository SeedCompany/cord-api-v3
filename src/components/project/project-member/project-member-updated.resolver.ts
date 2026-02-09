import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { keys } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { type ProjectMemberUpdate, ProjectMemberUpdated } from './dto';

@Resolver(ProjectMemberUpdated)
export class ProjectMemberUpdatedResolver {
  @ResolveField(() => [String], {
    description: stripIndent`
      A list of keys of the \`ProjectMemberUpdate\` object which have been updated.

      This can be used to determine which fields have been updated, since
      GQL cannot distinguish between omitted fields and explicit nulls.
    `,
  })
  updatedKeys(
    @Parent() { updated }: ProjectMemberUpdated,
  ): ReadonlyArray<keyof ProjectMemberUpdate> {
    return keys(updated);
  }
}

import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Resource } from '~/common';
import { Identity } from '~/core/authentication';
import { ResourceLoader } from '~/core/resources';
import { ChangesetResolver } from './changeset.resolver';
import { Changeset, ChangesetAware, ChangesetDiff } from './dto';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  constructor(
    private readonly resources: ResourceLoader,
    private readonly identity: Identity,
    private readonly changesetResolver: ChangesetResolver,
  ) {}

  @ResolveField()
  async changeset(@Parent() object: ChangesetAware): Promise<Changeset | null> {
    return object.changeset
      ? await this.resources.load(Changeset, object.changeset)
      : null;
  }

  @ResolveField(() => Resource, {
    description: 'The parent resource of this resource',
    nullable: true,
  })
  parent(): null {
    // Only projects reach this: they have no parent. Every other
    // ChangesetAware type resolves `parent` in its own resolver (from its
    // `project` or `budget` link), which takes precedence over this one.
    return null;
  }

  @ResolveField(() => ChangesetDiff, {
    nullable: true,
    description: stripIndent`
      The changes made within this changeset limited to this resource's sub-tree
    `,
  })
  async changesetDiff(
    @Parent() object: ChangesetAware,
  ): Promise<ChangesetDiff | null> {
    // TODO move to auth policy
    if (this.identity.isAnonymous) {
      return null;
    }

    const changeset = await this.changeset(object);
    if (!changeset) {
      return null;
    }
    const diff = await this.changesetResolver.difference(changeset, object.id);
    return diff;
  }
}

import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Fields, IsOnlyId, Resource } from '~/common';
import { Identity } from '~/core/authentication';
import { ResourceLoader, ResourceResolver } from '~/core/resources';
import { ChangesetResolver } from './changeset.resolver';
import { Changeset, ChangesetAware, ChangesetDiff } from './dto';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  constructor(
    private readonly resources: ResourceLoader,
    private readonly identity: Identity,
    private readonly resourceResolver: ResourceResolver,
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
  async parent(
    @Parent() object: ChangesetAware,
    @Info(Fields, IsOnlyId) isOnlyId: boolean,
  ) {
    if (!object.parent) {
      return null;
    }
    if (isOnlyId) {
      return {
        __typename: this.resourceResolver.resolveTypeByBaseNode(object.parent),
        id: object.parent.properties.id,
        changeset: object.changeset,
      };
    }
    return await this.resources.loadByBaseNode(object.parent);
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

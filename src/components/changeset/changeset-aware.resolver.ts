import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Fields, IsOnlyId, LoggedInSession, Resource, Session } from '~/common';
import { ResourceLoader, ResourceResolver } from '~/core';
import { ChangesetResolver } from './changeset.resolver';
import { Changeset, ChangesetAware, ChangesetDiff } from './dto';

@Resolver(ChangesetAware)
export class ChangesetAwareResolver {
  constructor(
    private readonly resources: ResourceLoader,
    private readonly resourceResolver: ResourceResolver,
    private readonly changesetResolver: ChangesetResolver
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
    @Info(Fields, IsOnlyId) isOnlyId: boolean
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
    @LoggedInSession() session: Session
  ): Promise<ChangesetDiff | null> {
    const changeset = await this.changeset(object);
    if (!changeset) {
      return null;
    }
    const diff = await this.changesetResolver.difference(
      changeset,
      session,
      object.id
    );
    return diff;
  }
}

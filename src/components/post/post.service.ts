import { Injectable } from '@nestjs/common';
import {
  CreationFailed,
  type ID,
  InputException,
  InvalidIdForTypeException,
  isIdLike,
  NotFoundException,
  Resource,
  SecuredList,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { Hooks } from '~/core/hooks';
import { LiveQueryStore } from '~/core/live-query';
import { ILogger, Logger } from '~/core/logger';
import { type BaseNode, isBaseNode } from '~/core/neo4j/results';
import { ResourceLoader, ResourcesHost } from '~/core/resources';
import { ResourceMutatedHook } from '../audit/resource-mutated.hook';
import { Privileges } from '../authorization';
import {
  type CreatePost,
  effectiveShareabilityOf,
  Post,
  Postable,
  type PostShareability,
  reachesAtLeast,
  type UpdatePost,
} from './dto';
import { type PostListInput, type SecuredPostList } from './dto/list-posts.dto';
import { PostModerationDrizzleRepository } from './post-moderation.drizzle.repository';
import { PostDrizzleRepository } from './post.drizzle.repository';
import { PostRepository } from './post.repository';

type ConcretePostable = Postable & { __typename: string };
type PostableRef = ID | BaseNode | ConcretePostable;

// A product decision, not a data invariant — see PostDrizzleRepository's
// countFeatured doc comment. Change this to change the cap; nothing else
// models it.
const MAX_FEATURED_POSTS_PER_REPORT = 3;

@Injectable()
export class PostService {
  constructor(
    private readonly identity: Identity,
    private readonly privileges: Privileges,
    private readonly repo: PostRepository,
    private readonly moderationRepo: PostModerationDrizzleRepository,
    private readonly drizzleRepo: PostDrizzleRepository,
    private readonly resources: ResourceLoader,
    private readonly resourcesHost: ResourcesHost,
    private readonly liveQueryStore: LiveQueryStore,
    @Logger('post:service') private readonly logger: ILogger,
    private readonly hooks: Hooks,
  ) {}

  async create(input: CreatePost): Promise<Post> {
    const perms = await this.getPermissionsFromPostable(input.parent);
    perms.verifyCan('create');

    try {
      const result = await this.repo.create(input);
      if (!result) {
        throw new CreationFailed(Post);
      }

      const postable = perms.context as ConcretePostable;
      this.liveQueryStore.invalidate([postable.__typename, postable.id]);

      // Unlike Update, a Create audit row doesn't get its field values from a
      // diff — there's nothing to diff against — so it's the only place the
      // as-submitted wording, type, and requested reach ever get captured.
      // Every future edit (a moderator's cleanup, a translator's pass) is
      // still just an Update row recording what it changed *to*, so this
      // snapshot is what makes the original recoverable from history later.
      await this.hooks.run(
        new ResourceMutatedHook('Post', result.dto.id, 'Create', {
          type: result.dto.type,
          shareability: result.dto.shareability,
          body: result.dto.body,
        }),
      );

      return this.secure(result.dto);
    } catch (exception) {
      this.logger.warning('Failed to create post', {
        exception,
      });

      if (!(await this.repo.getBaseNode(input.parent, 'BaseNode'))) {
        throw new InputException('Parent is invalid', 'parent');
      }

      throw new CreationFailed(Post, { cause: exception });
    }
  }

  async update(input: UpdatePost): Promise<Post> {
    const object = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(object, input);

    if ((changes as { featured?: boolean }).featured === true) {
      await this.verifyCanFeature(object, changes);
    }

    this.privileges.for(Post, object).verifyChanges(changes);
    const updated = await this.repo.update(object, changes);

    await this.hooks.run(
      new ResourceMutatedHook('Post', input.id, 'Update', changes),
    );

    return this.secure(updated);
  }

  /**
   * `featured` (curated into this quarter's Investor Report) only makes sense
   * once a post is actually part of a specific report, and only once it's
   * been cleared to leave Seed Company — otherwise this would be publishing
   * something nobody has approved for external reach. Checked against the
   * post's state *after* this same update's other changes apply, so a caller
   * can attach a report and feature it in one call.
   */
  private async verifyCanFeature(
    object: UnsecuredDto<Post>,
    changes: Record<string, unknown>,
  ) {
    const reportId =
      'report' in changes ? (changes.report as ID | null) : object.report?.id;
    if (!reportId) {
      throw new InputException(
        'Only posts submitted with a report can be featured for the Investor Report',
        'featured',
      );
    }

    const shareability =
      'shareability' in changes
        ? (changes.shareability as PostShareability)
        : object.shareability;
    const effective = effectiveShareabilityOf({
      shareability,
      approvedShareability: object.approvedShareability,
    });
    if (!reachesAtLeast(effective, 'AskToShareExternally')) {
      throw new InputException(
        'This post has not been cleared to leave Seed Company yet',
        'featured',
      );
    }

    // `changes.featured === true` at the call site means this post wasn't
    // already featured, so it's never among the rows this counts — no need
    // to exclude its own id.
    const alreadyFeatured = await this.drizzleRepo.countFeatured(
      reportId as ID<'PeriodicReport'>,
    );
    if (alreadyFeatured >= MAX_FEATURED_POSTS_PER_REPORT) {
      throw new InputException(
        `Up to ${MAX_FEATURED_POSTS_PER_REPORT} posts can be featured for the Investor Report`,
        'featured',
      );
    }
  }

  /**
   * Record a moderator's clearance on one or more posts.
   *
   * Two checks, and they are different questions:
   *  * may this person moderate at all — edit access to `approvedShareability`,
   *    which is what ModeratePostsPolicy grants;
   *  * is the requested clearance within what the author asked for — a
   *    moderator may narrow a post's reach or confirm it, never widen it.
   *
   * The second is not a permissions question. Widening someone else's
   * disclosure is a different act from approving it, and it should not be
   * reachable by fat-fingering a dropdown on a queue screen.
   */
  async moderate(
    ids: ReadonlyArray<ID<'Post'>>,
    shareability: PostShareability,
  ): Promise<Post[]> {
    const objects = await this.repo.readMany(ids);
    if (objects.length !== ids.length) {
      throw new NotFoundException('Could not find every post', 'ids');
    }

    for (const object of objects) {
      this.privileges
        .for(Post, object)
        .verifyCan('edit', 'approvedShareability');

      if (
        reachesAtLeast(shareability, object.shareability) &&
        shareability !== object.shareability
      ) {
        throw new InputException(
          `Cannot clear a post wider than its author asked for` +
            ` (requested ${object.shareability})`,
          'shareability',
        );
      }
    }

    await this.moderationRepo.clear(ids, shareability);

    for (const id of ids) {
      await this.hooks.run(
        new ResourceMutatedHook('Post', id, 'Update', {
          approvedShareability: shareability,
        }),
      );
    }

    // Re-read through the normal path so the returned posts are hydrated and
    // secured exactly like any other read, rather than by a second code path.
    const updated = await this.repo.readMany(ids);
    return updated.map((dto) => this.secure(dto));
  }

  /**
   * Posts on these parents that nobody has cleared yet.
   *
   * Reach that never needed review was cleared on insert, so an unreviewed row
   * is by construction one that does need a human.
   */
  async listAwaitingModeration(parentIds: readonly ID[]): Promise<Post[]> {
    const ids = await this.moderationRepo.findAwaitingReview(parentIds);
    const results = await this.repo.readMany(ids);
    return results.map((dto) => this.secure(dto));
  }

  async delete(id: ID): Promise<void> {
    const object = await this.repo.readOne(id);

    this.privileges.for(Post, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete post', {
        exception,
      });

      throw new ServerException('Failed to delete post', exception);
    }

    await this.hooks.run(new ResourceMutatedHook('Post', id, 'Delete'));
  }

  async securedList(
    parent: ConcretePostable & Resource,
    input: PostListInput,
  ): Promise<SecuredPostList> {
    // TODO move to auth policy
    if (this.identity.isAnonymous) {
      return SecuredList.Redacted;
    }

    const perms = await this.getPermissionsFromPostable(parent);

    if (!perms.can('read')) {
      return SecuredList.Redacted;
    }

    const results = await this.repo.securedList(input);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
      canRead: true, // false handled above
      canCreate: perms.can('create'),
    };
  }

  secure(dto: UnsecuredDto<Post>) {
    return this.privileges.for(Post).secure(dto);
  }

  async getPermissionsFromPostable(resource: PostableRef) {
    const parent = await this.loadPostable(resource);
    const parentType = this.resourcesHost.getByName(
      parent.__typename as 'Postable',
    );
    return this.privileges.for(parentType, parent).forEdge('posts');
  }

  private async loadPostable(resource: PostableRef): Promise<ConcretePostable> {
    const parentNode = isIdLike(resource)
      ? await this.repo.getBaseNode(resource, Resource)
      : resource;
    if (!parentNode) {
      throw new NotFoundException('Resource does not exist', 'resource');
    }
    const parent = isBaseNode(parentNode)
      ? ((await this.resources.loadByBaseNode(parentNode)) as ConcretePostable)
      : parentNode;

    try {
      this.resourcesHost.verifyImplements(parent.__typename, Postable);
    } catch (e) {
      throw new NonPostableType(e.message);
    }
    return parent;
  }
}

class NonPostableType extends InvalidIdForTypeException {}

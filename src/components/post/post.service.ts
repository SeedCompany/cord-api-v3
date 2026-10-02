import { Injectable } from '@nestjs/common';
import {
  CreationFailed,
  type ID,
  InputException,
  InvalidIdForTypeException,
  isIdLike,
  NotFoundException,
  type Resource,
  SecuredList,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { type ChangesOf } from '~/core/database/changes';
import { Hooks } from '~/core/hooks';
import { LiveQueryStore } from '~/core/live-query';
import { ILogger, Logger } from '~/core/logger';
import { type BaseNode, isBaseNode } from '~/core/resources';
import { ResourceLoader, ResourcesHost } from '~/core/resources';
import { ResourceMutatedHook } from '../audit/resource-mutated.hook';
import { Privileges } from '../authorization';
import {
  type CreatePost,
  effectiveShareabilityOf,
  needsModeration,
  Post,
  Postable,
  type PostShareability,
  reachesAtLeast,
  type UpdatePost,
} from './dto';
import { type PostListInput, type SecuredPostList } from './dto/list-posts.dto';
import { PostRepository } from './post.repository';

type ConcretePostable = Postable & { __typename: string };
type PostableRef = ID | BaseNode | ConcretePostable;

// A product decision, not a data invariant — see PostRepository.countFeatured.
// Change this to change the cap; nothing else models it.
const MAX_FEATURED_POSTS_PER_REPORT = 3;

@Injectable()
export class PostService {
  constructor(
    private readonly identity: Identity,
    private readonly privileges: Privileges,
    private readonly repo: PostRepository,
    private readonly resources: ResourceLoader,
    private readonly resourcesHost: ResourcesHost,
    private readonly liveQueryStore: LiveQueryStore,
    @Logger('post:service') private readonly logger: ILogger,
    private readonly hooks: Hooks,
  ) {}

  async create(input: CreatePost): Promise<Post> {
    const perms = await this.getPermissionsFromPostable(input.parent);
    perms.verifyCan('create');

    // Outside the try below, which would re-wrap this as a CreationFailed.
    if (input.report) {
      await this.verifyReportOnEngagement(input.report, input.parent);
    }

    try {
      const result = await this.repo.create(input);
      if (!result) {
        throw new CreationFailed(Post);
      }

      const postable = perms.context as ConcretePostable;
      this.liveQueryStore.invalidate([postable.__typename, postable.id]);

      // Unlike Update, a Create audit row gets no field values from a diff —
      // there is nothing to diff against — so this is the only place the
      // as-submitted wording, type and requested reach are ever captured.
      // Every later edit (a moderator's cleanup, a translator's pass) is an
      // Update row recording what it changed *to*, so this snapshot is what
      // makes the original recoverable from history.
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

      if (!(await this.repo.getBaseNode(input.parent))) {
        throw new InputException('Parent is invalid', 'parent');
      }

      throw new CreationFailed(Post, { cause: exception });
    }
  }

  async update(input: UpdatePost): Promise<Post> {
    const object = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(object, input);

    if (changes.report) {
      await this.verifyReportOnEngagement(
        changes.report,
        object.parent.properties.id,
      );
    }
    if (changes.featured === true) {
      await this.verifyCanFeature(object, changes);
    }

    const perms = this.privileges.for(Post, object);
    perms.verifyChanges(changes);
    // `type` and `shareability` are plain (unsecured) props, which
    // verifyChanges skips. They are the author's request, not a moderator's
    // decision, so changing them takes the object-level edit — the grant the
    // creator holds — rather than riding along with a prop-level one.
    if (changes.type !== undefined || changes.shareability !== undefined) {
      perms.verifyCan('edit');
    }

    const updated = await this.repo.update(object, changes);

    await this.hooks.run(
      new ResourceMutatedHook('Post', input.id, 'Update', changes),
    );

    return this.secure(updated);
  }

  /**
   * `featured` (curated into this quarter's Investor Report) only makes sense
   * once a post is actually part of a specific report, and only once it has
   * been cleared to leave Seed Company — otherwise this would be publishing
   * something nobody has approved for external reach. Checked against the
   * post's state *after* this same update's other changes apply, so a caller
   * can attach a report and feature it in one call.
   */
  private async verifyCanFeature(
    object: UnsecuredDto<Post>,
    changes: ChangesOf<Post, UpdatePost>,
  ) {
    const reportId =
      changes.report !== undefined
        ? changes.report
        : (object.report?.id ?? null);
    if (!reportId) {
      throw new InputException(
        'Only posts submitted with a report can be featured for the Investor Report',
        'featured',
      );
    }

    // A reach change in this same call resets or self-clears the approval
    // (see PostRepository.update), so judge the post as it will be written.
    const shareability = changes.shareability ?? object.shareability;
    const approvedShareability =
      changes.shareability === undefined
        ? object.approvedShareability
        : needsModeration(changes.shareability)
          ? null
          : changes.shareability;
    const effective = effectiveShareabilityOf({
      shareability,
      approvedShareability,
    });
    if (!reachesAtLeast(effective, 'AskToShareExternally')) {
      throw new InputException(
        'This post has not been cleared to leave Seed Company yet',
        'featured',
      );
    }

    const alreadyFeatured = await this.repo.countFeatured(
      reportId,
      object.id as ID<'Post'>,
    );
    if (alreadyFeatured >= MAX_FEATURED_POSTS_PER_REPORT) {
      throw new InputException(
        `Up to ${MAX_FEATURED_POSTS_PER_REPORT} posts can be featured for the Investor Report per report`,
        'featured',
      );
    }
  }

  /**
   * A post can only be submitted with a report on its own engagement: the
   * report has to exist, be live, hang off an engagement (not a project), and
   * that engagement has to be the post's parent. One message for all four,
   * since to the caller they are the same mistake.
   */
  private async verifyReportOnEngagement(reportId: ID, parentId: ID) {
    const report = await this.repo.readLiveReport(reportId);
    if (!report?.engagementId || report.engagementId !== parentId) {
      throw new InputException(
        "Report does not belong to this post's engagement",
        'report',
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
    if (objects.length !== new Set(ids).size) {
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

    await this.repo.clearModeration(ids, shareability);

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
      ? await this.repo.getBaseNode(resource)
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

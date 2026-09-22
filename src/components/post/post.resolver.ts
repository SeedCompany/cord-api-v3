import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg, mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { PeriodicReportLoader } from '../periodic-report';
import { SecuredPeriodicReport } from '../periodic-report/dto';
import { PostLoader, PostService } from '../post';
import { UserLoader } from '../user';
import { SecuredUser } from '../user/dto';
import {
  CreatePost,
  effectiveBodyOf,
  effectiveShareabilityOf,
  ModeratePost,
  ModeratePosts,
  Post,
  PostCreated,
  PostDeleted,
  PostShareability,
  PostsModerated,
  PostUpdated,
  UpdatePost,
} from './dto';

@Resolver(Post)
export class PostResolver {
  constructor(private readonly service: PostService) {}

  @Mutation(() => PostCreated, {
    description: 'Create a discussion post',
  })
  async createPost(@Args('input') input: CreatePost): Promise<PostCreated> {
    const post = await this.service.create(input);
    return { post };
  }

  @Query(() => Post, {
    description: 'Look up a post by ID',
  })
  async post(
    @IdArg() id: ID,
    @Loader(PostLoader) posts: LoaderOf<PostLoader>,
  ): Promise<Post> {
    return await posts.load(id);
  }

  @ResolveField(() => SecuredUser)
  async creator(
    @Parent() post: Post,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser> {
    return await mapSecuredValue(post.creator, ({ id }) => users.load(id));
  }

  @ResolveField(() => SecuredUser, {
    description: 'Who cleared this post for sharing, if anyone has.',
  })
  async approvedBy(
    @Parent() post: Post,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser> {
    return await mapSecuredValue(post.approvedBy, ({ id }) => users.load(id));
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description: `
      The quarterly report this post was submitted with, if any.

      Reading the report's period is how a feed labels an item — "FY26 Q4
      report" versus a bare date — which is what makes a mixed list of
      report-attached and ad-hoc posts readable.
    `,
  })
  async report(
    @Parent() post: Post,
    @Loader(PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ): Promise<SecuredPeriodicReport> {
    return await mapSecuredValue(post.report, ({ id }) => reports.load(id));
  }

  @ResolveField(() => Post, {
    nullable: true,
    description:
      'The post this one updates, e.g. an answer to a prayer request.',
  })
  async respondsTo(
    @Parent() post: Post,
    @Loader(PostLoader) posts: LoaderOf<PostLoader>,
  ): Promise<Post | null> {
    const id = post.respondsTo.value?.id;
    return id ? await posts.load(id) : null;
  }

  @ResolveField(() => PostShareability, {
    description: `
      How widely this post may actually be shared right now.

      \`approvedShareability\` if it has been reviewed, otherwise the requested
      reach capped at Internal. Read this rather than \`shareability\` anywhere
      the answer decides whether something leaves Seed Company — the requested
      value is an intent, not a permission.
    `,
  })
  effectiveShareability(@Parent() post: Post): PostShareability {
    return effectiveShareabilityOf({
      shareability: post.shareability,
      approvedShareability: post.approvedShareability.value ?? null,
    });
  }

  @ResolveField(() => String, {
    description: `
      The wording to show anywhere this post's content matters beyond the
      author's own view. \`finalBody\` if anyone has produced one (a
      translation, a moderator's touch-up), otherwise \`body\` unchanged.
    `,
  })
  effectiveBody(@Parent() post: Post): string {
    return effectiveBodyOf({
      body: post.body.value ?? '',
      finalBody: post.finalBody.value ?? null,
    });
  }

  @Mutation(() => PostsModerated, {
    description: `
      Clear a post for sharing at the given reach.

      Narrowing is an ordinary outcome, not a rejection — there is no reject
      mutation because the post always stays and only its reach changes.
    `,
  })
  async moderatePost(
    @Args('input') input: ModeratePost,
  ): Promise<PostsModerated> {
    const posts = await this.service.moderate([input.id], input.shareability);
    return { posts };
  }

  @Mutation(() => PostsModerated, {
    description: `
      Clear several posts at once, all at the same reach.

      The bulk form is the primary one: a reviewer holding a caseload at 1-2
      prayer items per engagement per week cannot work through them singly.
    `,
  })
  async moderatePosts(
    @Args('input') input: ModeratePosts,
  ): Promise<PostsModerated> {
    const posts = await this.service.moderate(input.ids, input.shareability);
    return { posts };
  }

  @Mutation(() => PostUpdated, {
    description: 'Update an existing Post',
  })
  async updatePost(@Args('input') input: UpdatePost): Promise<PostUpdated> {
    const post = await this.service.update(input);
    return { post };
  }

  @Mutation(() => PostDeleted, {
    description: 'Delete a post',
  })
  async deletePost(@IdArg() id: ID): Promise<PostDeleted> {
    await this.service.delete(id);
    return {};
  }
}

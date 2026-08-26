import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { type GraphQLResolveInfo } from 'graphql';
import { ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { PostListInput, SecuredPostList } from '../post/dto/list-posts.dto';
import { PostType } from '../post/dto/post-type.enum';
import { PostLoader } from '../post/post.loader';
import { PostService } from '../post/post.service';
import { GTLReport } from './dto';

/**
 * Prayer on a GTL report.
 *
 * The report inherits the whole `posts` list from Postable; this narrows it to
 * the prayer kind so the section can't be polluted by notes or stories filed
 * against the same quarter. Writing goes through the ordinary `createPost`
 * mutation with `type: Prayer` — there is nothing GTL-specific about making a
 * prayer request, so there is no GTL-specific mutation.
 */
@Resolver(GTLReport)
export class GtlReportPrayerResolver {
  constructor(private readonly posts: PostService) {}

  @ResolveField(() => SecuredPostList, {
    description:
      'The prayer requests and praises shared in this quarter, newest first.',
  })
  async prayerRequests(
    @Info() info: GraphQLResolveInfo,
    @Parent() report: GTLReport,
    @ListArg(PostListInput) input: PostListInput,
    @Loader(PostLoader) loader: LoaderOf<PostLoader>,
  ): Promise<SecuredPostList> {
    const list = await this.posts.securedList(
      { ...report, __typename: info.parentType.name },
      {
        ...input,
        filter: {
          ...input.filter,
          parentId: report.id,
          type: PostType.Prayer,
        },
      },
    );
    loader.primeAll(list.items);
    return list;
  }
}

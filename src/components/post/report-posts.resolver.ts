import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { GTLReport } from '../gtl-report/dto';
import { type IPeriodicReport } from '../periodic-report/dto';
import { ProgressReport } from '../progress-report/dto';
import { PostListInput, SecuredPostList } from './dto/list-posts.dto';
import { PostLoader } from './post.loader';
import { PostService } from './post.service';

// `GTLReport.posts` / `ProgressReport.posts` — the posts submitted with this
// report, out of the engagement's feed (`Engagement.posts`).
//
// A report is not itself Postable: a post belongs to its engagement and is
// *attributed* to a report (see `Post.report`), so this is the engagement's
// list narrowed to one quarter — same permissions, same `canCreate`, same
// optional filters — rather than a second place posts can live. Declared on
// the two concrete report types, not on `IPeriodicReport`, because Financial
// and Narrative reports hang off a project and take no posts.

const description = `
  Posts submitted with this report — the prayer requests (and other posts) on
  the report's engagement that were written for this quarter.

  The engagement's \`posts\` narrowed to this report, with the same permissions
  and the same \`canCreate\`. A post is created on the engagement with
  \`report\` set to this report's id, not on the report itself.
`;

const listFor = async (
  service: PostService,
  report: IPeriodicReport,
  input: PostListInput,
  posts: LoaderOf<PostLoader>,
): Promise<SecuredPostList> => {
  const list = await service.securedList(report.parent, {
    ...input,
    filter: {
      ...input.filter,
      parentId: report.parent.properties.id,
      report: report.id,
    },
  });
  posts.primeAll(list.items);
  return list;
};

@Resolver(GTLReport)
export class GtlReportPostsResolver {
  constructor(private readonly service: PostService) {}

  @ResolveField(() => SecuredPostList, { description })
  async posts(
    @Parent() report: GTLReport,
    @ListArg(PostListInput) input: PostListInput,
    @Loader(PostLoader) posts: LoaderOf<PostLoader>,
  ): Promise<SecuredPostList> {
    return await listFor(this.service, report, input, posts);
  }
}

@Resolver(ProgressReport)
export class ProgressReportPostsResolver {
  constructor(private readonly service: PostService) {}

  @ResolveField(() => SecuredPostList, { description })
  async posts(
    @Parent() report: ProgressReport,
    @ListArg(PostListInput) input: PostListInput,
    @Loader(PostLoader) posts: LoaderOf<PostLoader>,
  ): Promise<SecuredPostList> {
    return await listFor(this.service, report, input, posts);
  }
}

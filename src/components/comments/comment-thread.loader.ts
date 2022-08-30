import { Logger } from '@nestjs/common';
import { ID, UnauthorizedException } from '~/common';
import { LoaderFactory, OrderedNestDataLoader, ResourceLoader } from '~/core';
import { AuthorizationService } from '../authorization/authorization.service';
import { resourceFromName } from '../authorization/model/resource-map';
import { CommentService } from './comment.service';
import { Commentable, CommentThread } from './dto';

@LoaderFactory(() => CommentThread)
export class CommentThreadLoader extends OrderedNestDataLoader<CommentThread> {
  constructor(
    private readonly commentThreads: CommentService,
    private readonly auth: AuthorizationService,
    private readonly resources: ResourceLoader
  ) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    const threads = await this.commentThreads.readManyThreads(ids);
    return await Promise.all(
      threads.map(async (thread) => {
        const parent = await this.resources.loadByBaseNode(thread.parent);
        const { commentThreads: perms } = await this.auth.getPermissions<
          typeof Commentable
        >({
          // @ts-expect-error We are assuming this is an implementation of Commentable
          resource: resourceFromName(parent.__typename),
          dto: parent,
          sessionOrUserId: this.session,
        });
        // this can be null on dev error
        if (!perms) {
          Logger.warn(
            `${parent.__typename} does not have any \`commentThreads\` permissions defined`,
            'authorization'
          );
        }
        if (!perms?.canRead) {
          const error = new UnauthorizedException(
            'You do not have the permission to view this comment thread'
          );
          return { key: thread.id, error };
        }
        return {
          ...thread,
          canDelete: true,
        };
      })
    );
  }
}

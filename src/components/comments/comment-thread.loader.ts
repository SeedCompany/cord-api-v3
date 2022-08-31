import { ID, UnauthorizedException } from '~/common';
import { isAdmin } from '~/common/session';
import { LoaderFactory, OrderedNestDataLoader } from '~/core';
import { CommentService } from './comment.service';
import { CommentThread } from './dto';

@LoaderFactory(() => CommentThread)
export class CommentThreadLoader extends OrderedNestDataLoader<CommentThread> {
  constructor(private readonly service: CommentService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    const session = this.session;
    const threads = await this.service.readManyThreads(ids);
    return await Promise.all(
      threads.map(async (thread) => {
        const perms = await this.service.getPermissionsFromResource(
          thread.parent,
          session
        );
        if (!perms?.canRead) {
          const error = new UnauthorizedException(
            'You do not have the permission to view this comment thread'
          );
          return { key: thread.id, error };
        }
        return {
          ...thread,
          canDelete: thread.creator === session.userId || isAdmin(session),
        };
      })
    );
  }
}

import { type ID } from '~/common';
import { LoaderFactory, OrderedNestDataLoader } from '~/core';
import { CommentRepository } from './comment.repository';
import { CommentService } from './comment.service';
import { CommentThread } from './dto';

@LoaderFactory(() => CommentThread)
export class CommentThreadLoader extends OrderedNestDataLoader<CommentThread> {
  constructor(
    private readonly service: CommentService,
    private readonly repo: CommentRepository,
  ) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    const threads = await this.repo.threads.readMany(ids);
    return await Promise.all(
      threads.map(async (thread) => {
        try {
          await this.service.verifyCanView(thread.parent);
          return this.service.secureThread(thread);
        } catch (error) {
          return { key: thread.id, error };
        }
      }),
    );
  }
}

import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { CommentRepository } from './comment.repository';
import { CommentService } from './comment.service';
import { CommentThread } from './dto';

@LoaderFactory(() => CommentThread)
export class CommentThreadLoader
  implements DataLoaderStrategy<CommentThread, ID<CommentThread>>
{
  constructor(
    private readonly service: CommentService,
    private readonly repo: CommentRepository,
  ) {}

  async loadMany(ids: ReadonlyArray<ID<CommentThread>>) {
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

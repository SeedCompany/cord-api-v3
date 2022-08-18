import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import { CommentService } from './comment.service';
import { CommentThread } from './dto';

@LoaderFactory()
export class CommentThreadLoader extends OrderedNestDataLoader<CommentThread> {
  constructor(private readonly commentThreads: CommentService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.commentThreads.readManyThreads(ids, this.session);
  }
}

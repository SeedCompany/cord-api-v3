import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { CommentService } from './comment.service';
import { CommentThread } from './dto';

@Injectable({ scope: Scope.REQUEST })
export class CommentThreadLoader extends OrderedNestDataLoader<CommentThread> {
  constructor(private readonly commentThreads: CommentService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.commentThreads.readManyThreads(ids, this.session);
  }
}

import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { CommentService } from './comment.service';
import { Comment } from './dto';

@Injectable({ scope: Scope.REQUEST })
export class CommentLoader extends OrderedNestDataLoader<Comment> {
  constructor(private readonly comments: CommentService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.comments.readMany(ids, this.session);
  }
}

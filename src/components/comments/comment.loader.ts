import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { LoaderFactory } from '../../core/resources/loader.registry';
import { CommentService } from './comment.service';
import { Comment } from './dto';

@LoaderFactory()
export class CommentLoader extends OrderedNestDataLoader<Comment> {
  constructor(private readonly comments: CommentService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.comments.readMany(ids, this.session);
  }
}

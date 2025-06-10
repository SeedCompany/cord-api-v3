import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { CommentService } from './comment.service';
import { Comment } from './dto';

@LoaderFactory(() => Comment)
export class CommentLoader implements DataLoaderStrategy<Comment, ID<Comment>> {
  constructor(private readonly comments: CommentService) {}

  async loadMany(ids: ReadonlyArray<ID<Comment>>) {
    return await this.comments.readMany(ids);
  }
}

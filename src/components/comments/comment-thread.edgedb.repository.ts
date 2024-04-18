import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { CommentThreadRepository as Neo4jRepository } from './comment-thread.repository';
import { CommentThread } from './dto/comment-thread.dto';

@Injectable()
export class CommentThreadEdgeDBRepository
  extends RepoFor(CommentThread, {
    hydrate: (CommentThread) => ({
      ...CommentThread['*'],
      report: true,
    }),
  }).withDefaults()
  implements PublicOf<Neo4jRepository> {}

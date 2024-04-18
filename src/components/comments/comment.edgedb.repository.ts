import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { CommentRepository as Neo4jRepository } from './comment.repository';
import { Comment } from './dto/comment.dto';

@Injectable()
export class CommentEdgeDBRepository
  extends RepoFor(Comment, {
    hydrate: (Comment) => ({
      ...Comment['*'],
      report: true,
    }),
  }).withDefaults()
  implements PublicOf<Neo4jRepository> {}

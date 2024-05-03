import { creator, Policy } from '../util';

@Policy('all', (r) =>
  [r.Post, r.CommentThread, r.Comment].flatMap(
    (it) => it.when(creator).edit.delete,
  ),
)
export class UserCanManageOwnCommentsPolicy {}

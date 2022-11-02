import { owner, Policy } from '../util';

@Policy('all', (r) => [
  r.Post.when(owner).edit.delete,
  r.CommentThread.when(owner).edit,
  r.Comment.when(owner).edit,
])
export class UserCanManageOwnCommentsPolicy {}

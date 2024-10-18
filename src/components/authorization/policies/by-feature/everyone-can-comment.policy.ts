import { Policy } from '../util';

@Policy('all', (r) => [
  // Technically, we want only when the Commentable is readable.
  // I think this is sufficient for practical use at this point in time.
  ...[r.CommentThread, r.Comment].flatMap((it) => it.read.create),
  // This shouldn't be needed, but it is. children() needs rewrite.
  r.Commentable.children((c) => c.commentThreads.read.create),
])
export class EveryoneCanCommentPolicy {}

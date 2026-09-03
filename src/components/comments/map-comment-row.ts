import { DateTime } from 'luxon';
import { type UnsecuredDto } from '~/common';
import { type comments } from '~/core/drizzle/schema';
import { type Comment } from './dto';

/**
 * Map a `comments` row to its UnsecuredDto. Shared by the comment repo's
 * `toDto` and the thread repo's first/latest-comment hydration so the mapping
 * lives in one place (and avoids a circular import between the two repos).
 */
export const mapCommentRow = (
  row: typeof comments.$inferSelect,
): UnsecuredDto<Comment> => {
  const dto: unknown = {
    id: row.id,
    createdAt: DateTime.fromJSDate(row.createdAt),
    thread: row.threadId,
    creator: row.creatorId,
    body: row.body,
    modifiedAt: DateTime.fromJSDate(row.modifiedAt),
  };
  return dto as UnsecuredDto<Comment>;
};

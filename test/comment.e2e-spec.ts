import { beforeAll, describe, expect, it } from '@jest/globals';
import { CalendarDate } from '~/common';
import { graphql } from '~/graphql';
import {
  createLanguage,
  createProject,
  createSession,
  createTestApp,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

/** Minimal block-editor document the RichText (JSONObject) scalar accepts. */
const doc = (text: string) => ({
  version: '1',
  time: 1,
  blocks: [{ id: text, type: 'paragraph', data: { text } }],
});

interface RichDoc {
  blocks: Array<{ data: { text: string } }>;
}
const textOf = (value: unknown) => (value as RichDoc).blocks[0]!.data.text;

describe('Comment e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app);
  });

  it('creates, lists, updates, and deletes comments on a commentable', async () => {
    await runAsAdmin(app, async (a) => {
      const language = await createLanguage(a);

      // First comment creates a new thread on the language.
      const { createComment } = await a.graphql.mutate(CreateCommentDoc, {
        input: { resource: language.id, body: doc('First comment') },
      });
      const first = createComment.comment;
      const threadId = createComment.commentThread.id;
      expect(first.id).toBeTruthy();
      expect(textOf(first.body.value)).toBe('First comment');

      // The thread is listed on the parent, hydrated with its first comment.
      const listed = await a.graphql.query(CommentThreadsDoc, {
        resource: language.id,
      });
      expect(listed.commentThreads.total).toBe(1);
      expect(listed.commentThreads.items[0]!.id).toBe(threadId);
      expect(listed.commentThreads.items[0]!.firstComment.id).toBe(first.id);

      // Second comment attaches to the existing thread.
      const { createComment: secondCreated } = await a.graphql.mutate(
        CreateCommentDoc,
        {
          input: {
            resource: language.id,
            thread: threadId,
            body: doc('Second comment'),
          },
        },
      );
      const second = secondCreated.comment;

      const withTwo = await a.graphql.query(CommentThreadCommentsDoc, {
        id: threadId,
      });
      expect(withTwo.commentThread.comments.total).toBe(2);
      expect(
        withTwo.commentThread.comments.items
          .map((c) => textOf(c.body.value))
          .sort((x, y) => x.localeCompare(y)),
      ).toEqual(['First comment', 'Second comment']);

      // Update the second comment's body.
      const { updateComment } = await a.graphql.mutate(UpdateCommentDoc, {
        input: { id: second.id, body: doc('Edited second') },
      });
      expect(textOf(updateComment.comment.body.value)).toBe('Edited second');

      // Deleting a non-first comment leaves the thread intact.
      await a.graphql.mutate(DeleteCommentDoc, { id: second.id });
      const afterOne = await a.graphql.query(CommentThreadCommentsDoc, {
        id: threadId,
      });
      expect(afterOne.commentThread.comments.total).toBe(1);

      // Deleting the first (thread-owning) comment removes the whole thread.
      await a.graphql.mutate(DeleteCommentDoc, { id: first.id });
      const afterAll = await a.graphql.query(CommentThreadsDoc, {
        resource: language.id,
      });
      expect(afterAll.commentThreads.total).toBe(0);
    });
  });

  // ProgressReport implements Commentable. Regression guard for the PG
  // parent-resolution path (resolveResourceBaseNode), which previously excluded
  // ProgressReport and rejected this valid commentable under DATABASE=postgres.
  it('creates a comment on a ProgressReport parent', async () => {
    await runAsAdmin(app, async (a) => {
      const project = await createProject(a, {
        mouStart: CalendarDate.local(2023, 1, 1).toISO(),
        mouEnd: CalendarDate.local(2024, 1, 1).toISO(),
      });
      const language = await createLanguage(a);
      const { createEng } = await a.graphql.mutate(CreateLangEngForCommentDoc, {
        input: { project: project.id, language: language.id },
      });
      const reportId = createEng.engagement.progressReports.items[0]!.id;
      expect(reportId).toBeTruthy();

      const { createComment } = await a.graphql.mutate(CreateCommentDoc, {
        input: { resource: reportId, body: doc('Report comment') },
      });
      expect(createComment.comment.id).toBeTruthy();

      const listed = await a.graphql.query(CommentThreadsDoc, {
        resource: reportId,
      });
      expect(listed.commentThreads.total).toBe(1);
    });
  });
});

const CreateLangEngForCommentDoc = graphql(`
  mutation CreateLangEngForComment($input: CreateLanguageEngagement!) {
    createEng: createLanguageEngagement(input: $input) {
      engagement {
        id
        ... on LanguageEngagement {
          progressReports(input: { count: 1 }) {
            items {
              id
            }
          }
        }
      }
    }
  }
`);

const CreateCommentDoc = graphql(`
  mutation CreateComment($input: CreateComment!) {
    createComment(input: $input) {
      comment {
        id
        body {
          value
        }
      }
      commentThread {
        id
      }
    }
  }
`);

const CommentThreadsDoc = graphql(`
  query CommentThreads($resource: ID!) {
    commentThreads(resource: $resource) {
      total
      items {
        id
        firstComment {
          id
        }
      }
    }
  }
`);

const CommentThreadCommentsDoc = graphql(`
  query CommentThreadComments($id: ID!) {
    commentThread(id: $id) {
      id
      comments {
        total
        items {
          id
          body {
            value
          }
        }
      }
    }
  }
`);

const UpdateCommentDoc = graphql(`
  mutation UpdateComment($input: UpdateComment!) {
    updateComment(input: $input) {
      comment {
        id
        body {
          value
        }
      }
    }
  }
`);

const DeleteCommentDoc = graphql(`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id) {
      __typename
    }
  }
`);

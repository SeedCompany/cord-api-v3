import { beforeAll, describe, expect, it } from '@jest/globals';
import { graphql } from '~/graphql';
import {
  createLanguage,
  createSession,
  createTestApp,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

describe('Post e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app);
  });

  it('creates posts, hides Membership posts on a member-less parent, updates and deletes', async () => {
    await runAsAdmin(app, async (a) => {
      const language = await createLanguage(a);

      // Internal shareability — always visible.
      const { createPost: internal } = await a.graphql.mutate(CreatePostDoc, {
        input: {
          parent: language.id,
          type: 'Note',
          shareability: 'Internal',
          body: 'Internal note',
        },
      });
      expect(internal.post.id).toBeTruthy();
      expect(internal.post.body.value).toBe('Internal note');
      expect(internal.post.shareability).toBe('Internal');

      // Membership shareability — create returns it to the author, but a
      // Language has no members, so it's hidden from the list.
      const { createPost: membership } = await a.graphql.mutate(CreatePostDoc, {
        input: {
          parent: language.id,
          type: 'Prayer',
          shareability: 'Membership',
          body: 'Members only',
        },
      });
      expect(membership.post.id).toBeTruthy();

      const listed = await a.graphql.query(PostsDoc, { id: language.id });
      const ids = listed.language.posts.items.map((p) => p.id);
      expect(ids).toContain(internal.post.id);
      expect(ids).not.toContain(membership.post.id);

      // Update the visible post.
      const { updatePost } = await a.graphql.mutate(UpdatePostDoc, {
        input: {
          id: internal.post.id,
          type: 'Note',
          shareability: 'Internal',
          body: 'Edited note',
        },
      });
      expect(updatePost.post.body.value).toBe('Edited note');

      // Delete it — it drops out of the list.
      await a.graphql.mutate(DeletePostDoc, { id: internal.post.id });
      const afterDelete = await a.graphql.query(PostsDoc, { id: language.id });
      expect(afterDelete.language.posts.items.map((p) => p.id)).not.toContain(
        internal.post.id,
      );
    });
  });
});

const CreatePostDoc = graphql(`
  mutation CreatePost($input: CreatePost!) {
    createPost(input: $input) {
      post {
        id
        type
        shareability
        body {
          value
        }
      }
    }
  }
`);

const PostsDoc = graphql(`
  query LanguagePosts($id: ID!) {
    language(id: $id) {
      posts {
        total
        items {
          id
          shareability
          body {
            value
          }
        }
      }
    }
  }
`);

const UpdatePostDoc = graphql(`
  mutation UpdatePost($input: UpdatePost!) {
    updatePost(input: $input) {
      post {
        id
        body {
          value
        }
      }
    }
  }
`);

const DeletePostDoc = graphql(`
  mutation DeletePost($id: ID!) {
    deletePost(id: $id) {
      __typename
    }
  }
`);

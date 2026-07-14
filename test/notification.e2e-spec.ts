import { beforeAll, describe, expect, it } from '@jest/globals';
import { graphql } from '~/graphql';
import {
  createSession,
  createTestApp,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

describe('Notification e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    // The requesting user — system notifications fan out to all users, so
    // this user is among the recipients of anything created below.
    await registerUser(app);
  });

  it('delivers a system notification and tracks per-user read state', async () => {
    const message = 'The server will restart at midnight.';
    const { createSystemNotification: created } = await runAsAdmin(app, (a) =>
      a.graphql.mutate(CreateSystemNotificationDoc, { message }),
    );
    expect(created.totalRecipients).toBeGreaterThanOrEqual(1);

    // The requesting user sees it, unread, hydrated as a SystemNotification.
    const before = await app.graphql.query(NotificationsDoc, { input: {} });
    const found = before.notifications.items.find(
      (n) => n.id === created.notification.id,
    );
    expect(found).toBeDefined();
    expect(found?.__typename).toBe('SystemNotification');
    expect(found?.unread).toBe(true);
    expect(found?.readAt).toBeNull();
    if (found?.__typename === 'SystemNotification') {
      expect(found.message).toBe(message);
    }
    expect(before.notifications.totalUnread).toBeGreaterThanOrEqual(1);

    // Mark it read — readAt is set and unread flips.
    const { readNotification: read } = await app.graphql.mutate(
      ReadNotificationDoc,
      { id: created.notification.id, unread: false },
    );
    expect(read.unread).toBe(false);
    expect(read.readAt).toBeTruthy();

    // The unread filter now excludes it.
    const unreadOnly = await app.graphql.query(NotificationsDoc, {
      input: { filter: { unread: true } },
    });
    expect(
      unreadOnly.notifications.items.find(
        (n) => n.id === created.notification.id,
      ),
    ).toBeUndefined();

    // Marking unread again restores it.
    const { readNotification: reUnread } = await app.graphql.mutate(
      ReadNotificationDoc,
      { id: created.notification.id, unread: true },
    );
    expect(reUnread.unread).toBe(true);
    expect(reUnread.readAt).toBeNull();
  });

  it('counts unread independently of the requested page filter', async () => {
    // Two more system notifications, both unread for the requesting user.
    await runAsAdmin(app, async (a) => {
      await a.graphql.mutate(CreateSystemNotificationDoc, { message: 'one' });
      await a.graphql.mutate(CreateSystemNotificationDoc, { message: 'two' });
    });

    const readList = await app.graphql.query(NotificationsDoc, {
      input: { filter: { unread: false } },
    });
    // totalUnread reflects all unread, not just the filtered (read) page.
    expect(readList.notifications.totalUnread).toBeGreaterThanOrEqual(2);
  });
});

const CreateSystemNotificationDoc = graphql(`
  mutation CreateSystemNotification($message: Markdown!) {
    createSystemNotification(message: $message) {
      notification {
        id
      }
      totalRecipients
    }
  }
`);

const NotificationsDoc = graphql(`
  query Notifications($input: NotificationListInput!) {
    notifications(input: $input) {
      total
      totalUnread
      hasMore
      items {
        id
        __typename
        unread
        readAt
        ... on SystemNotification {
          message
        }
      }
    }
  }
`);

const ReadNotificationDoc = graphql(`
  mutation ReadNotification($id: ID!, $unread: Boolean) {
    readNotification(id: $id, unread: $unread) {
      id
      unread
      readAt
    }
  }
`);

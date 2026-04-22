import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const userStatusEnum = pgEnum('user_status', ['Active', 'Disabled']);

// Tables are added here as each domain is migrated to PostgreSQL.

// ─── Users ─────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  isRoot: boolean('is_root').notNull().default(false),
  status: userStatusEnum('status').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  globalRoles: many(userGlobalRoles),
  sessions: many(authSessions),
  identity: one(authIdentities, {
    fields: [users.id],
    references: [authIdentities.userId],
  }),
}));

export const userGlobalRoles = pgTable(
  'user_global_roles',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const userGlobalRolesRelations = relations(
  userGlobalRoles,
  ({ one }) => ({
    user: one(users, {
      fields: [userGlobalRoles.userId],
      references: [users.id],
    }),
  }),
);

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authSessions = pgTable(
  'auth_sessions',
  {
    token: text('token').primaryKey(),
    // Null = anonymous session. Set on login, cleared on logout (soft delete via active flag).
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Set when connectSessionToUser runs (i.e. actual login time, not token creation time).
    loggedInAt: timestamp('logged_in_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
  },
  (t) => [index('auth_sessions_user_id_idx').on(t.userId)],
);

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));

// One row per user; updated in place on password change.
export const authIdentities = pgTable('auth_identities', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const authIdentitiesRelations = relations(authIdentities, ({ one }) => ({
  user: one(users, {
    fields: [authIdentities.userId],
    references: [users.id],
  }),
}));

// Short-lived tokens for password reset. Deleted after use.
export const authEmailTokens = pgTable('auth_email_tokens', {
  token: text('token').primaryKey(),
  email: text('email').notNull(),
  createdOn: timestamp('created_on', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

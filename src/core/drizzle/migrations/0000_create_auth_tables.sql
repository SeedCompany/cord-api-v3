CREATE TYPE "user_status" AS ENUM ('Active', 'Disabled');

CREATE TABLE "users" (
  "id"         text        PRIMARY KEY NOT NULL,
  "is_root"    boolean     NOT NULL DEFAULT false,
  "status"     user_status NOT NULL,
  "email"      text        NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "user_global_roles" (
  "user_id" text NOT NULL,
  "role"    text NOT NULL,
  CONSTRAINT "user_global_roles_pkey" PRIMARY KEY ("user_id", "role"),
  CONSTRAINT "user_global_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "auth_sessions" (
  "token"         text        PRIMARY KEY NOT NULL,
  "user_id"       text,
  "created_at"    timestamptz NOT NULL DEFAULT now(),
  "logged_in_at"  timestamptz,
  "active"        boolean     NOT NULL DEFAULT true,
  CONSTRAINT "auth_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

-- Partial index so session lookups only scan active rows.
CREATE INDEX "auth_sessions_active_idx" ON "auth_sessions" ("token")
  WHERE active = true;

-- Covers deactivateAllOtherSessions / deactivateAllSessions updates by user.
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions" ("user_id");

CREATE TABLE "auth_identities" (
  "user_id"       text        PRIMARY KEY NOT NULL,
  "password_hash" text        NOT NULL,
  "updated_at"    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "auth_identities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE TABLE "auth_email_tokens" (
  "token"      text        PRIMARY KEY NOT NULL,
  "email"      text        NOT NULL,
  "created_on" timestamptz NOT NULL DEFAULT now()
);

-- Fast lookups when clearing all tokens for an email after password reset.
CREATE INDEX "auth_email_tokens_email_idx" ON "auth_email_tokens" ("email");

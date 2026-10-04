-- Add a dedicated identity table for Auth0-authenticated users, mirroring
-- `auth_identities` (password hashes) rather than reusing it — sharing would
-- force `auth_identities.password_hash` nullable and weaken the password
-- path's invariant that every row there has a real hash.
--
-- `sub` (Auth0's immutable subject identifier) is the re-match key, not
-- email: unlike a password identity, this user's email can change upstream
-- (Okta profile edit, Auth0 Database connection password reset, etc.)
-- without our side knowing, so `sub` has to survive that. It's required and
-- unique: one Auth0 subject maps to at most one Cord user.
--
-- No `deleted_at` here, same as `auth_identities` — this table is
-- FK-cascaded off `users` and carries no independent lifecycle.

CREATE TABLE "auth_identities_auth0" (
  "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "sub" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "auth_identities_auth0_sub_unique" ON "auth_identities_auth0" ("sub");

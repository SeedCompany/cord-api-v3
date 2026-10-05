-- Phase 2 of the Auth0 login migration: the password-based auth system is
-- fully retired (including the root/admin bootstrap account), so the two
-- tables backing it are no longer read or written by anything. Both are
-- FK-cascaded off `users` with no independent lifecycle of their own, same
-- as `auth_identities_auth0` which replaces them.

DROP TABLE IF EXISTS "auth_password_reset_tokens" CASCADE;
DROP TABLE IF EXISTS "auth_identities" CASCADE;

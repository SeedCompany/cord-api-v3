-- Let a Neo4j blank stay blank.
--
-- Neo4j stores a field only when somebody sets it: `planned` on a ceremony is a
-- separate Property node, and ~90% of ceremonies never got one. Postgres
-- declared these columns NOT NULL DEFAULT <something>, so the cutover loader had
-- to invent a value for every row that had never had one — turning "nobody ever
-- recorded this" into a definite answer. A warehouse comparison caught it from
-- the outside: ceremonies read 'N' on Postgres and blank on Neo4j.
--
-- Dropping NOT NULL costs nothing at the API. Every one of these fields is
-- exposed through a `Secured*` wrapper, and every wrapper already emits a
-- nullable `value` — clients have always had to handle a blank here, because
-- Neo4j has always returned one.
--
-- ⚠ The DEFAULT goes with the NOT NULL, deliberately. Drizzle omits an
-- `undefined` key from an INSERT, which hands the column back to its default —
-- so a field merely *absent* in the source would be silently re-filled by the
-- very default this migration exists to remove. Every create path writes these
-- columns explicitly (`input.marketable ?? false`), so nothing new arrives
-- blank and no application insert depends on the default.
--
-- ⚠ This migration does NOT convert existing `false`/'Active'/'' rows to NULL,
-- and cannot: once the value has been written there is no way to tell an
-- invented one from a real one. Any database already populated by the cutover
-- ETL must be RELOADED to pick up the preserved blanks.

ALTER TABLE "ceremonies" ALTER COLUMN "planned" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "ceremonies" ALTER COLUMN "planned" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "engagements" ALTER COLUMN "marketable" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "engagements" ALTER COLUMN "marketable" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "preset_inventory" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "projects" ALTER COLUMN "preset_inventory" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "global_innovations_client" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "global_innovations_client" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "active" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "partners" ALTER COLUMN "active" DROP NOT NULL;
--> statement-breakpoint
-- users.status has no DEFAULT to drop; the loader always supplied one.
ALTER TABLE "users" ALTER COLUMN "status" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "timezone" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "timezone" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "real_first_name" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "real_first_name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "real_last_name" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "real_last_name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "display_first_name" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "display_first_name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "display_last_name" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "display_last_name" DROP NOT NULL;

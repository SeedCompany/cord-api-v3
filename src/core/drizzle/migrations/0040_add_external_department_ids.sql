-- Migration: add external_department_ids — the department IDs that already exist
-- in Intacct (the accounting system) and therefore must never be handed out to a
-- CORD project.
--
-- This is a reservation list, not an entity. Nothing points at these rows and
-- they point at nothing; their only job is to be subtracted from the pool of
-- available department IDs in set-department-id.handler.ts. In Neo4j they are
-- 565 fully disconnected `ExternalDepartmentId` nodes, which is why they read as
-- droppable on a first pass — but the handler unions them into the "already
-- used" set on every assignment, and has since 2025-09.
--
-- Measured against the 2026-08-24 production copy: 389 of the 565 codes fall
-- inside blocks CORD assigns from, and two blocks would hand out a different ID
-- with this list missing than with it present. A collision here is invisible to
-- CORD — projects_department_id_active_unique catches CORD-internal duplicates,
-- but nothing in this database knows what Intacct holds.

CREATE TABLE "external_department_ids" (
  -- The reservation IS the identity. The source nodes carry an apoc-generated
  -- uuid that names nothing and is referenced by nothing, so it is not carried;
  -- the department ID is what the handler looks up and what must be unique.
  "department_id" text PRIMARY KEY,

  -- The Intacct department name. Not unique, legitimately: one name covers three
  -- codes in the current data. Carried because it is what a person needs when
  -- reconciling a reservation against Intacct.
  "name" text NOT NULL,

  -- When the list was imported, carried from the source nodes. Kept because the
  -- staleness of this list is the interesting thing about it: every current row
  -- was loaded in a single manual run and nothing has refreshed it since.
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Deliberately no CHECK on the shape of department_id. The obvious one — five
-- digits, matching how the handler pads block IDs — would reject a real row:
-- 564 of the 565 codes are five digits and one is six. This table mirrors an
-- external system, so it must accept whatever that system holds; a constraint
-- that edits the mirror makes it stop being a mirror.
--
-- Deliberately no deleted_at either. These are not CORD records with a
-- lifecycle; when Intacct changes, the list is re-imported.

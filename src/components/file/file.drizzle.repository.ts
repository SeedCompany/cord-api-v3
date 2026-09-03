import { Injectable } from '@nestjs/common';
import { and, asc, count, eq, ilike, inArray, sql } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CreationFailed,
  generateId,
  type ID,
  InputException,
  NotFoundException,
} from '~/common';
import { Identity } from '~/core/authentication';
import {
  DrizzleService,
  escapeLikePattern,
  resolveOrderBy,
} from '~/core/drizzle';
import { fileNodes } from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';
import { type BaseNode } from '~/core/neo4j/results';
import {
  FileListInput,
  type FileListOutput,
  type FileNode,
  FileNodeType,
  FileVersion,
  resolveFileNode,
} from './dto';
import { reverseAttachmentByRootIds } from './resolve-file-attachment';

type FileNodeRow = typeof fileNodes.$inferSelect;

/**
 * Postgres/Drizzle implementation of the file tree (Phase 7, PR #1).
 *
 * Single `file_nodes` table, single-table inheritance keyed on `type`. The tree
 * is a `parent_id` self-FK; ancestors/descendants are walked with recursive
 * CTEs (no ltree — dir trees are shallow, matching Neo4j's per-query `[:parent*]`).
 * A File's mime/size are surfaced from its denormalized `latest_version_id`;
 * Directory size/totalFiles/modifiedAt are computed at read time over descendants.
 *
 * Binary bytes live in S3 (key = FileVersion id) and are untouched — FileService
 * owns all S3 work and is engine-agnostic.
 *
 * migration-todo (cutover): drop alongside the Neo4j FileRepository.
 */
@Injectable()
export class FileDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
    private readonly liveQueryStore: LiveQueryStore,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  async getById(id: ID): Promise<FileNode> {
    const [node] = await this.hydrateMany([id]);
    if (!node) {
      throw new NotFoundException();
    }
    return node;
  }

  async getByIds(ids: readonly ID[]): Promise<readonly FileNode[]> {
    return await this.hydrateMany(ids);
  }

  async getByName(parentId: ID, name: string): Promise<FileNode> {
    const rows = await this.db
      .select({ id: fileNodes.id })
      .from(fileNodes)
      .where(
        and(
          eq(fileNodes.parentId, parentId),
          eq(fileNodes.name, name),
          sql`${fileNodes.deletedAt} is null`,
        ),
      )
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException();
    }
    return await this.getById(rows[0]!.id);
  }

  async getParentsById(id: ID): Promise<readonly FileNode[]> {
    // Ancestors of `id`, nearest first (excludes self) — mirrors Neo4j's
    // `(start)-[:parent*]->(node)` ordered by hop count.
    const result = await this.db.execute<{ id: ID }>(sql`
      WITH RECURSIVE ancestors AS (
        SELECT p.id, p.parent_id, 1 AS depth
        FROM ${fileNodes} start
        JOIN ${fileNodes} p ON p.id = start.parent_id
        WHERE start.id = ${id}
        UNION ALL
        SELECT p.id, p.parent_id, a.depth + 1
        FROM ancestors a
        JOIN ${fileNodes} p ON p.id = a.parent_id
      )
      SELECT id FROM ancestors ORDER BY depth ASC
    `);
    const orderedIds = result.rows.map((r) => r.id);
    const nodes = await this.hydrateMany(orderedIds);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return orderedIds.flatMap((nodeId) => {
      const node = byId.get(nodeId);
      return node ? [node] : [];
    });
  }

  async getChildrenById(
    parent: FileNode,
    input?: FileListInput,
  ): Promise<FileListOutput> {
    input ??= FileListInput.defaultValue(FileListInput);
    const conditions = [
      eq(fileNodes.parentId, parent.id),
      sql`${fileNodes.deletedAt} is null`,
    ];
    if (input.filter?.name) {
      conditions.push(
        ilike(fileNodes.name, `%${escapeLikePattern(input.filter.name)}%`),
      );
    }
    if (input.filter?.type) {
      conditions.push(eq(fileNodes.type, input.filter.type));
    }
    // Exclude version-less File placeholders (DefinedFiles created without an
    // upload) at the SQL level so count + page run on the same rows we actually
    // return. hydrateMany drops them too (defense-in-depth), but the pagination
    // math must not count rows that never appear in `items` — otherwise `total`
    // over-counts and a page of only placeholders comes back empty with
    // `hasMore: true`.
    conditions.push(
      sql`(${fileNodes.type} != ${FileNodeType.File} or ${fileNodes.latestVersionId} is not null)`,
    );
    const predicate = and(...conditions);
    const offset = (input.page - 1) * input.count;
    const [countRows, pageRows] = await Promise.all([
      this.db.select({ total: count() }).from(fileNodes).where(predicate),
      this.db
        .select({ id: fileNodes.id })
        .from(fileNodes)
        .where(predicate)
        .orderBy(
          ...resolveOrderBy(
            input,
            { name: fileNodes.name, createdAt: fileNodes.createdAt },
            fileNodes.name,
          ),
          asc(fileNodes.id),
        )
        .limit(input.count)
        .offset(offset),
    ]);
    const total = countRows[0]?.total ?? 0;
    const orderedIds = pageRows.map((r) => r.id);
    const nodes = await this.hydrateMany(orderedIds);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const items = orderedIds.flatMap((id) => {
      const node = byId.get(id);
      return node ? [node] : [];
    });
    return {
      items,
      total,
      hasMore: offset + items.length < total,
    };
  }

  async getBaseNode(id: ID): Promise<BaseNode | undefined> {
    const [row] = await this.db
      .select({
        id: fileNodes.id,
        type: fileNodes.type,
        createdAt: fileNodes.createdAt,
      })
      .from(fileNodes)
      .where(and(eq(fileNodes.id, id), sql`${fileNodes.deletedAt} is null`))
      .limit(1);
    if (!row) {
      return undefined;
    }
    return this.fakeBaseNode(row.id, row.type, row.createdAt);
  }

  async createDirectory(
    parentId: ID | undefined,
    name: string,
    { public: isPublic }: { public?: boolean } = {},
  ): Promise<ID> {
    const id = await generateId();
    await this.db.insert(fileNodes).values({
      id,
      type: FileNodeType.Directory,
      name,
      public: await this.resolvePublic(isPublic, parentId),
      parentId: parentId ?? null,
      createdById: this.identity.current.userId,
      // App clock (honors luxon Settings.now in tests / time-travel), matching
      // the Neo4j path — not Postgres defaultNow().
      createdAt: DateTime.now().toJSDate(),
    });
    return id;
  }

  async createRootDirectory({
    name,
    public: isPublic,
  }: {
    // `resource` + `relation` describe the attachment point in Neo4j (an
    // incoming `[relation]` edge from the owning BaseNode). Under PG this is a
    // no-op: the consuming domain's own repo writes the FK column directly
    // (e.g. `project.drizzle.repository.ts` sets `rootDirectoryId`), and
    // `resolveFileRootAttachments` resolves `rootAttachedTo` at read time by
    // reverse-looking-up which row's FK points at this id — see
    // `resolve-file-attachment.ts`. Kept only for interface parity with the
    // Neo4j repo's signature.
    resource: unknown;
    relation: string;
    name: string;
    public?: boolean;
  }): Promise<ID> {
    const id = await generateId();
    await this.db.insert(fileNodes).values({
      id,
      type: FileNodeType.Directory,
      name,
      public: isPublic ?? null,
      parentId: null,
      createdById: this.identity.current.userId,
      // App clock (honors luxon Settings.now in tests / time-travel), matching
      // the Neo4j path — not Postgres defaultNow().
      createdAt: DateTime.now().toJSDate(),
    });
    return id;
  }

  async createFile({
    fileId,
    name,
    parentId,
    public: isPublic,
  }: {
    fileId: ID;
    name: string;
    parentId?: ID;
    // propOfNode is a no-op under PG, same reasoning as `resource`/`relation`
    // on `createRootDirectory` above: the consuming domain's own repo writes
    // its FK column directly, and reverse-lookup resolves the attachment at
    // read time. Kept only for interface parity with the Neo4j repo.
    propOfNode?: [baseNodeId: ID, propertyName: string];
    public?: boolean;
  }): Promise<ID> {
    await this.db.insert(fileNodes).values({
      id: fileId,
      type: FileNodeType.File,
      name,
      public: await this.resolvePublic(isPublic, parentId),
      parentId: parentId ?? null,
      createdById: this.identity.current.userId,
      // App clock (honors luxon Settings.now in tests / time-travel), matching
      // the Neo4j path — not Postgres defaultNow().
      createdAt: DateTime.now().toJSDate(),
    });
    return fileId;
  }

  async createFileVersion(
    fileId: ID,
    input: Pick<FileVersion, 'id' | 'name' | 'mimeType' | 'size'> & {
      public?: boolean;
    },
  ): Promise<FileVersion> {
    await this.db.insert(fileNodes).values({
      id: input.id,
      type: FileNodeType.FileVersion,
      name: input.name,
      mimeType: input.mimeType,
      size: input.size,
      public: await this.resolvePublic(input.public, fileId),
      parentId: fileId,
      createdById: this.identity.current.userId,
      // App clock (honors luxon Settings.now in tests / time-travel), matching
      // the Neo4j path — not Postgres defaultNow().
      createdAt: DateTime.now().toJSDate(),
    });
    // Denormalize the parent File's latest version (single writer).
    await this.db
      .update(fileNodes)
      .set({ latestVersionId: input.id })
      .where(eq(fileNodes.id, fileId));

    const node = await this.getById(input.id);
    if (node.type !== FileNodeType.FileVersion) {
      throw new CreationFailed(FileVersion);
    }
    return node as unknown as FileVersion;
  }

  async rename(fileNode: FileNode, newName: string): Promise<void> {
    // Mirrors the Neo4j arm, where `db.updateProperties({ type:
    // resolveFileNode(fileNode) })` announces under the CONCRETE type. The store
    // keys on `${resource.name}:${id}`, so `FileNode:` — the interface — would
    // emit something nothing subscribes to. FileService.rename() already skips
    // the call when the name is unchanged, so this never fires as a no-op.
    this.liveQueryStore.invalidate([resolveFileNode(fileNode), fileNode.id]);
    await this.db
      .update(fileNodes)
      .set({ name: newName })
      .where(eq(fileNodes.id, fileNode.id));
  }

  async move(
    id: ID,
    newParentId: ID,
  ): Promise<{ oldParent: BaseNode; newParent: BaseNode }> {
    const [current] = await this.db
      .select({ parentId: fileNodes.parentId })
      .from(fileNodes)
      .where(eq(fileNodes.id, id))
      .limit(1);
    if (!current?.parentId) {
      throw new InputException('Old or new parent does not exist');
    }
    const parents = await this.db
      .select({
        id: fileNodes.id,
        type: fileNodes.type,
        createdAt: fileNodes.createdAt,
      })
      .from(fileNodes)
      .where(inArray(fileNodes.id, [current.parentId, newParentId]));
    const oldRow = parents.find((p) => p.id === current.parentId);
    const newRow = parents.find((p) => p.id === newParentId);
    if (!oldRow || !newRow) {
      throw new InputException('Old or new parent does not exist');
    }
    // Reject moving a node into itself or one of its own descendants. Neo4j's
    // variable-length `[:parent*]` match tolerates a cycle, but our recursive
    // CTEs (computeRoots / computeDirectoryAggregates / delete's subtree walk)
    // have no cycle guard and would recurse forever. Walk up from the
    // destination; if `id` is the new parent or an ancestor of it, the move
    // would close a loop.
    if (newParentId === id) {
      throw new InputException('Cannot move a node into itself');
    }
    const cycle = await this.db.execute<{ id: ID }>(sql`
      WITH RECURSIVE up AS (
        SELECT id, parent_id FROM ${fileNodes} WHERE id = ${newParentId}
        UNION ALL
        SELECT p.id, p.parent_id FROM up JOIN ${fileNodes} p ON p.id = up.parent_id
      )
      SELECT id FROM up WHERE id = ${id} LIMIT 1
    `);
    if (cycle.rows.length > 0) {
      throw new InputException('Cannot move a node into its own descendant');
    }
    await this.db
      .update(fileNodes)
      .set({ parentId: newParentId })
      .where(eq(fileNodes.id, id));
    return {
      oldParent: this.fakeBaseNode(oldRow.id, oldRow.type, oldRow.createdAt),
      newParent: this.fakeBaseNode(newRow.id, newRow.type, newRow.createdAt),
    };
  }

  async delete(fileNode: FileNode): Promise<void> {
    // Soft-delete the node and its whole subtree.
    const deleted = await this.db.execute<{ id: ID; type: FileNodeType }>(sql`
      WITH RECURSIVE subtree AS (
        SELECT id FROM ${fileNodes} WHERE id = ${fileNode.id}
        UNION ALL
        SELECT c.id FROM subtree s JOIN ${fileNodes} c ON c.parent_id = s.id
      )
      UPDATE ${fileNodes} SET deleted_at = now()
      WHERE id IN (SELECT id FROM subtree)
      RETURNING id, type
    `);
    // The Neo4j arm's `deleteNode(fileNode, { resource: resolveFileNode(...) })`
    // announces the top node only. RETURNING gives us the whole subtree for free
    // — no extra round trip — so a live query watching a file *inside* a deleted
    // directory is told as well. Deliberately better than Neo4j here rather than
    // a divergence to be reverted. FileNodeType's values are exactly the
    // registered resource names, so the row's `type` is the key we want.
    this.liveQueryStore.invalidateAll(
      deleted.rows.map((row) => [row.type, row.id] as const),
    );
    // Neo4j computes a File's latest version dynamically from its *active*
    // versions, so deleting the current version falls back to the previous one
    // (or none). We denormalize latest_version_id, so repoint any surviving
    // File whose latest version was just soft-deleted to its newest remaining
    // version — or null, which makes it a version-less placeholder (not-found),
    // matching Neo4j's "no active version" state.
    const repointed = await this.db.execute<{ id: ID<'File'> }>(sql`
      UPDATE ${fileNodes} f
      SET latest_version_id = (
        SELECT v.id FROM ${fileNodes} v
        WHERE v.parent_id = f.id
          AND v.type = ${FileNodeType.FileVersion}
          AND v.deleted_at IS NULL
        ORDER BY v.created_at DESC, v.id DESC
        LIMIT 1
      )
      WHERE f.type = ${FileNodeType.File}
        AND f.deleted_at IS NULL
        AND f.latest_version_id IS NOT NULL
        AND (
          SELECT lv.deleted_at FROM ${fileNodes} lv
          WHERE lv.id = f.latest_version_id
        ) IS NOT NULL
      RETURNING f.id
    `);
    // These Files survived, but their surfaced mimeType/size/modifiedAt just
    // changed with the repoint, and they are not in the subtree above. Same
    // free-RETURNING reasoning; deleting a FileVersion otherwise left the parent
    // File's open page showing the removed version's metadata.
    this.liveQueryStore.invalidateAll(
      repointed.rows.map((row) => [FileNodeType.File, row.id] as const),
    );
  }

  // ─── hydration ─────────────────────────────────────────────────────────────

  private async hydrateMany(ids: readonly ID[]): Promise<FileNode[]> {
    if (ids.length === 0) {
      return [];
    }
    const allRows = await this.db
      .select()
      .from(fileNodes)
      .where(
        and(
          inArray(fileNodes.id, ids as ID[]),
          sql`${fileNodes.deletedAt} is null`,
        ),
      );
    // A version-less File is a DefinedFile placeholder (created without an
    // upload). Neo4j's hydrate requires a latest version, so getById treats it
    // as not-found — which is how resolveDefinedFile yields null until a version
    // is uploaded. Mirror that: drop File rows with no latest version.
    const rows = allRows.filter(
      (r) => !(r.type === FileNodeType.File && r.latestVersionId == null),
    );
    if (rows.length === 0) {
      return [];
    }

    const roots = await this.computeRoots(rows.map((r) => r.id));

    // Files surface their latest version's mime/size/modifiedBy/modifiedAt.
    const latestVersionIds = rows
      .filter((r) => r.type === FileNodeType.File && r.latestVersionId)
      .map((r) => r.latestVersionId!);
    const versionsById = new Map<ID, FileNodeRow>();
    if (latestVersionIds.length > 0) {
      const versionRows = await this.db
        .select()
        .from(fileNodes)
        .where(
          and(
            inArray(fileNodes.id, latestVersionIds),
            // Never surface a soft-deleted version's metadata/size (delete()
            // repoints latest_version_id, but filter here as defense-in-depth).
            sql`${fileNodes.deletedAt} is null`,
          ),
        );
      for (const v of versionRows) {
        versionsById.set(v.id, v);
      }
    }

    const dirIds = rows
      .filter((r) => r.type === FileNodeType.Directory)
      .map((r) => r.id);
    const aggregates = await this.computeDirectoryAggregates(dirIds);

    // The resource each node's tree root is attached to (reverse-lookup across
    // the consuming DefinedFile FK columns). Batched over distinct roots.
    const distinctRootIds = [...new Set([...roots.values()].map((r) => r.id))];
    const attachmentByRoot = await reverseAttachmentByRootIds(
      this.db,
      distinctRootIds,
    );

    return rows.map((row) => {
      const root = roots.get(row.id);
      const rootNode = root
        ? this.fakeBaseNode(root.id, root.type, root.createdAt)
        : this.fakeBaseNode(row.id, row.type, row.createdAt);
      const base = {
        id: row.id,
        type: row.type,
        name: row.name,
        public: row.public ?? false,
        createdAt: toDateTime(row.createdAt),
        createdById: row.createdById,
        root: rootNode,
        // The resource holding the tree root. Falls back to the root node
        // itself (a Directory — never ProgressReportMedia, so the upload-time
        // file-is-media check short-circuits) when nothing references it, e.g.
        // a test root dir or a free-floating tree.
        rootAttachedTo: attachmentByRoot.get(root?.id ?? row.id) ?? [
          rootNode,
          'dir',
        ],
        canDelete: true,
      };

      if (row.type === FileNodeType.FileVersion) {
        return {
          ...base,
          mimeType: row.mimeType,
          size: Number(row.size ?? 0),
        } as unknown as FileNode;
      }
      if (row.type === FileNodeType.File) {
        const version = row.latestVersionId
          ? versionsById.get(row.latestVersionId)
          : undefined;
        return {
          ...base,
          mimeType: version?.mimeType ?? '',
          size: Number(version?.size ?? 0),
          latestVersionId: row.latestVersionId,
          modifiedById: version?.createdById ?? row.createdById,
          modifiedAt: toDateTime(version?.createdAt ?? row.createdAt),
        } as unknown as FileNode;
      }
      // Directory
      const agg = aggregates.get(row.id);
      return {
        ...base,
        size: agg?.size ?? 0,
        totalFiles: agg?.totalFiles ?? 0,
        firstFileCreated: agg?.firstFileCreated,
        modifiedBy: agg?.modifiedBy ?? row.createdById,
        modifiedAt: toDateTime(agg?.modifiedAt ?? row.createdAt),
      } as unknown as FileNode;
    });
  }

  /** Topmost ancestor (self if no parent) for each id. */
  private async computeRoots(
    ids: readonly ID[],
  ): Promise<
    Map<ID, { id: ID; type: FileNodeType; createdAt: Date | string }>
  > {
    // Raw execute → timestamps come back as SQL strings (see toDateTime).
    const result = await this.db.execute<{
      startId: ID;
      rootId: ID;
      rootType: FileNodeType;
      rootCreatedAt: string;
    }>(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id AS start_id, id AS node_id, parent_id, type, created_at, 0 AS depth
        FROM ${fileNodes}
        WHERE id IN (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})
        UNION ALL
        SELECT a.start_id, p.id, p.parent_id, p.type, p.created_at, a.depth + 1
        FROM ancestors a
        JOIN ${fileNodes} p ON p.id = a.parent_id
      )
      SELECT DISTINCT ON (start_id)
        start_id AS "startId", node_id AS "rootId",
        type AS "rootType", created_at AS "rootCreatedAt"
      FROM ancestors
      ORDER BY start_id, depth DESC
    `);
    const map = new Map<
      ID,
      { id: ID; type: FileNodeType; createdAt: Date | string }
    >();
    for (const r of result.rows) {
      map.set(r.startId, {
        id: r.rootId,
        type: r.rootType,
        createdAt: r.rootCreatedAt,
      });
    }
    return map;
  }

  /** Read-time directory aggregates over descendant Files + their latest versions. */
  private async computeDirectoryAggregates(dirIds: readonly ID[]): Promise<
    Map<
      ID,
      {
        size: number;
        totalFiles: number;
        firstFileCreated?: ID;
        modifiedBy?: ID;
        modifiedAt?: Date | string;
      }
    >
  > {
    const map = new Map<
      ID,
      {
        size: number;
        totalFiles: number;
        firstFileCreated?: ID;
        modifiedBy?: ID;
        modifiedAt?: Date | string;
      }
    >();
    if (dirIds.length === 0) {
      return map;
    }
    // Raw execute → timestamps come back as SQL strings (see toDateTime).
    const result = await this.db.execute<{
      dirId: ID;
      fileId: ID;
      fileCreatedAt: string;
      lvSize: string | number | null;
      lvCreatedAt: string | null;
      lvCreatedBy: ID | null;
    }>(sql`
      WITH RECURSIVE descendants AS (
        SELECT id AS dir_id, id AS node_id, type, latest_version_id, created_at
        FROM ${fileNodes}
        WHERE id IN (${sql.join(
          dirIds.map((id) => sql`${id}`),
          sql`, `,
        )}) AND deleted_at IS NULL
        UNION ALL
        SELECT d.dir_id, c.id, c.type, c.latest_version_id, c.created_at
        FROM descendants d
        JOIN ${fileNodes} c ON c.parent_id = d.node_id AND c.deleted_at IS NULL
      )
      SELECT
        d.dir_id AS "dirId", d.node_id AS "fileId", d.created_at AS "fileCreatedAt",
        lv.size AS "lvSize", lv.created_at AS "lvCreatedAt",
        lv.created_by_id AS "lvCreatedBy"
      FROM descendants d
      LEFT JOIN ${fileNodes} lv
        ON lv.id = d.latest_version_id AND lv.deleted_at IS NULL
      WHERE d.type = 'File'
    `);

    const grouped = new Map<ID, typeof result.rows>();
    for (const r of result.rows) {
      const list = grouped.get(r.dirId) ?? [];
      list.push(r);
      grouped.set(r.dirId, list);
    }
    for (const dirId of dirIds) {
      const files = grouped.get(dirId) ?? [];
      let size = 0;
      let firstFile: { id: ID; at: number } | undefined;
      let modified: { by: ID; at: string; ms: number } | undefined;
      for (const f of files) {
        size += Number(f.lvSize ?? 0);
        const createdMs = toDateTime(f.fileCreatedAt).toMillis();
        if (!firstFile || createdMs < firstFile.at) {
          firstFile = { id: f.fileId, at: createdMs };
        }
        if (f.lvCreatedAt && f.lvCreatedBy) {
          const ms = toDateTime(f.lvCreatedAt).toMillis();
          if (!modified || ms > modified.ms) {
            modified = { by: f.lvCreatedBy, at: f.lvCreatedAt, ms };
          }
        }
      }
      map.set(dirId, {
        size,
        totalFiles: files.length,
        firstFileCreated: firstFile?.id,
        modifiedBy: modified?.by,
        modifiedAt: modified?.at,
      });
    }
    return map;
  }

  private async resolvePublic(
    explicit: boolean | undefined,
    parentId: ID | undefined,
  ): Promise<boolean | null> {
    if (explicit != null) {
      return explicit;
    }
    if (!parentId) {
      return null;
    }
    const [parent] = await this.db
      .select({ public: fileNodes.public })
      .from(fileNodes)
      .where(eq(fileNodes.id, parentId))
      .limit(1);
    return parent?.public ?? null;
  }

  private fakeBaseNode(
    id: ID,
    type: FileNodeType,
    createdAt: Date | string,
  ): BaseNode {
    return {
      identity: id,
      labels: [type, 'FileNode', 'BaseNode'],
      properties: {
        id,
        createdAt: toDateTime(createdAt),
      },
    } as unknown as BaseNode;
  }
}

// Drizzle's query builder returns `timestamp` columns as Date objects, but raw
// `db.execute` returns them as Postgres wire strings ("2026-06-15 17:00:36+00")
// — which is SQL format, not ISO 8601.
const toDateTime = (value: Date | string): DateTime =>
  value instanceof Date ? DateTime.fromJSDate(value) : DateTime.fromSQL(value);

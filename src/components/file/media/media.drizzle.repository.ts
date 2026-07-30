import { Injectable } from '@nestjs/common';
import { eq, inArray, or, type SQL } from 'drizzle-orm';
import type { Except, RequireAtLeastOne } from 'type-fest';
import {
  generateId,
  type ID,
  NotFoundException,
  ServerException,
} from '~/common';
import { DrizzleService } from '~/core/drizzle';
import { fileNodes, media } from '~/core/drizzle/schema';
import { type BaseNode } from '~/core/neo4j/results';
import { resolveFileRootAttachment } from '../resolve-file-attachment';
import { type AnyMedia } from './media.dto';

type MediaRow = typeof media.$inferSelect;
type SaveInput = RequireAtLeastOne<Pick<AnyMedia, 'id' | 'file'>> &
  Partial<Except<AnyMedia, 'attachedTo'>>;

/**
 * Postgres/Drizzle implementation of Media (Phase 7). One `media` row per
 * FileVersion (Image/Video/Audio sidecar). `attachedTo` — the resource holding
 * the root file node — is resolved by reverse-lookup across the consuming
 * DefinedFile FK columns (see resolveFileRootAttachment).
 *
 * migration-todo (cutover): drop alongside the Neo4j MediaRepository.
 */
@Injectable()
export class MediaDrizzleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  protected get db() {
    return this.drizzle.client;
  }

  async readOne(
    input: RequireAtLeastOne<Pick<AnyMedia, 'id' | 'file'>>,
  ): Promise<AnyMedia> {
    const [media] = await this.readMany(
      input.id ? { mediaIds: [input.id] } : { fvIds: [input.file!] },
    );
    if (!media) {
      throw new NotFoundException('Media not found');
    }
    return media;
  }

  async readMany(
    input: RequireAtLeastOne<Record<'fvIds' | 'mediaIds', readonly ID[]>>,
  ): Promise<AnyMedia[]> {
    const conditions: SQL[] = [];
    if (input.fvIds?.length) {
      conditions.push(inArray(media.fileVersionId, input.fvIds as ID[]));
    }
    if (input.mediaIds?.length) {
      conditions.push(inArray(media.id, input.mediaIds as ID[]));
    }
    if (conditions.length === 0) {
      return [];
    }
    const rows = await this.db
      .select()
      .from(media)
      .where(conditions.length === 1 ? conditions[0] : or(...conditions));
    return await Promise.all(rows.map((row) => this.toDto(row)));
  }

  // No live-query invalidation, deliberately: the Neo4j `save` is raw Cypher
  // that reaches none of CommonRepository's announcing helpers, so it is silent
  // too. Matching it keeps this a pre-existing product gap on every engine
  // rather than a cutover regression. Media is also always read through its
  // FileVersion, which the file repo does announce.
  async save(input: SaveInput): Promise<AnyMedia> {
    if (input.__typename) {
      // Detection result — upsert the full media row keyed on the file version.
      if (!input.file) {
        throw new ServerException('Media save requires a file version');
      }
      const values = toDbValues(input);
      await this.db
        .insert(media)
        .values({
          id: await generateId(),
          fileVersionId: input.file,
          type: input.__typename,
          mimeType: input.mimeType ?? '',
          ...values,
        })
        .onConflictDoUpdate({ target: media.fileVersionId, set: values });
    } else {
      // Metadata-only update (altText/caption) of existing media.
      const set = toDbValues(input);
      const result = input.id
        ? await this.db
            .update(media)
            .set(set)
            .where(eq(media.id, input.id))
            .returning({ id: media.id })
        : await this.db
            .update(media)
            .set(set)
            .where(eq(media.fileVersionId, input.file!))
            .returning({ id: media.id });
      if (result.length === 0) {
        if (input.id) {
          const exists = await this.getBaseNode(input.id, 'Media');
          if (!exists) throw new NotFoundException('Media could not be found');
        }
        if (input.file) {
          const exists = await this.getBaseNode(input.file, 'FileVersion');
          if (!exists) {
            throw new NotFoundException(
              'Media could not be saved to nonexistent file',
            );
          }
        }
        throw new ServerException('Failed to save media info');
      }
    }

    return await this.readOne(
      input.id ? { id: input.id } : { file: input.file! },
    );
  }

  async getBaseNode(
    id: ID,
    label: 'Media' | 'FileVersion',
  ): Promise<BaseNode | undefined> {
    const table = label === 'Media' ? media : fileNodes;
    const [row] = await this.db
      .select({ createdAt: table.createdAt })
      .from(table)
      .where(eq(table.id, id))
      .limit(1);
    if (!row) {
      return undefined;
    }
    return {
      identity: id,
      labels: [label, 'BaseNode'],
      properties: { id },
    } as unknown as BaseNode;
  }

  private async toDto(row: MediaRow): Promise<AnyMedia> {
    const attachedTo = await resolveFileRootAttachment(
      this.db,
      row.fileVersionId,
    );
    const base = {
      __typename: row.type,
      id: row.id,
      file: row.fileVersionId,
      mimeType: row.mimeType,
      altText: row.altText,
      caption: row.caption,
      attachedTo,
    };
    if (row.type === 'Image') {
      return {
        ...base,
        dimensions: { width: row.width ?? 0, height: row.height ?? 0 },
      } as unknown as AnyMedia;
    }
    if (row.type === 'Video') {
      return {
        ...base,
        dimensions: { width: row.width ?? 0, height: row.height ?? 0 },
        duration: row.duration ?? 0,
      } as unknown as AnyMedia;
    }
    return { ...base, duration: row.duration ?? 0 } as unknown as AnyMedia;
  }
}

/** Map a save input to media column values, mirroring the Neo4j `toDbShape`. */
const toDbValues = (input: SaveInput): Record<string, unknown> => {
  const values: Record<string, unknown> = {};
  if (input.altText !== undefined) values.altText = input.altText;
  if (input.caption !== undefined) values.caption = input.caption;
  if (input.mimeType !== undefined) values.mimeType = input.mimeType;
  if (input.__typename) {
    values.type = input.__typename;
    // Visual types carry dimensions; clear them otherwise.
    if (input.__typename === 'Image' || input.__typename === 'Video') {
      values.width = input.dimensions?.width ?? null;
      values.height = input.dimensions?.height ?? null;
    } else {
      values.width = null;
      values.height = null;
    }
    // Temporal types carry duration; clear it otherwise.
    if (input.__typename === 'Audio' || input.__typename === 'Video') {
      values.duration = input.duration ?? null;
    } else {
      values.duration = null;
    }
  }
  return values;
};

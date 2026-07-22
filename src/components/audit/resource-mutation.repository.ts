import { Injectable } from '@nestjs/common';
import { and, count, desc, eq } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import { resourceMutations } from '~/core/drizzle/schema';
import {
  type RecordMutationInput,
  type ResourceMutation,
  type ResourceMutationListInput,
} from './dto/resource-mutation.dto';

@Injectable()
export class ResourceMutationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  protected get db() {
    return this.drizzle.client;
  }

  async record(input: RecordMutationInput): Promise<void> {
    await this.db.insert(resourceMutations).values({
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      action: input.action,
      actorId: input.actorId,
      roleAtTime: [...input.roleAtTime],
      changes: input.changes ?? null,
    });
  }

  async listByResource(
    resourceType: string,
    resourceId: ID,
    input: ResourceMutationListInput,
  ): Promise<{ items: ResourceMutation[]; total: number; hasMore: boolean }> {
    const predicate = and(
      eq(resourceMutations.resourceType, resourceType),
      eq(resourceMutations.resourceId, resourceId),
    );
    const offset = (input.page - 1) * input.count;
    const [countRows, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(resourceMutations)
        .where(predicate),
      this.db
        .select()
        .from(resourceMutations)
        .where(predicate)
        .orderBy(desc(resourceMutations.at), desc(resourceMutations.id))
        .limit(input.count)
        .offset(offset),
    ]);
    const total = countRows[0]?.total ?? 0;
    const items = rows.map((row) => ({
      id: String(row.id),
      action: row.action,
      at: DateTime.fromJSDate(row.at),
      actor: row.actorId ? { id: row.actorId } : null,
      roleAtTime: row.roleAtTime ?? [],
      changes: (row.changes as Record<string, unknown> | null) ?? null,
    }));
    return { items, total, hasMore: offset + rows.length < total };
  }
}

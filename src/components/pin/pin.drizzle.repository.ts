import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { type ID } from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { pins } from '~/core/drizzle/schema';

@Injectable()
export class PinDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  async isPinned(id: ID): Promise<boolean> {
    const userId = this.identity.current.userId;
    const [row] = await this.db
      .select({ resourceId: pins.resourceId })
      .from(pins)
      .where(and(eq(pins.userId, userId), eq(pins.resourceId, id)))
      .limit(1);
    return !!row;
  }

  async add(id: ID): Promise<void> {
    await this.db
      .insert(pins)
      .values({ userId: this.identity.current.userId, resourceId: id })
      .onConflictDoNothing();
  }

  async remove(id: ID): Promise<void> {
    await this.db
      .delete(pins)
      .where(
        and(
          eq(pins.userId, this.identity.current.userId),
          eq(pins.resourceId, id),
        ),
      );
  }
}

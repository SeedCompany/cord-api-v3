import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { and, eq, isNull } from 'drizzle-orm';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { type ID, Role } from '~/common';
import { AuthenticationRepository } from '~/core/authentication/authentication.repository';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  authIdentities,
  organizations,
  userGlobalRoles,
  users,
} from '~/core/drizzle/schema';

@Injectable()
export class AdminDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly moduleRef: ModuleRef,
  ) {}

  @Once() get auth() {
    return this.moduleRef.get(AuthenticationRepository, { strict: false });
  }

  async finishing(callback: () => Promise<void>) {
    await callback();
  }

  async findRootUser() {
    const [row] = await this.drizzle.client
      .select({
        id: users.id,
        email: users.email,
        hash: authIdentities.passwordHash,
      })
      .from(users)
      .leftJoin(authIdentities, eq(authIdentities.userId, users.id))
      .where(and(eq(users.isRoot, true), isNull(users.deletedAt)))
      .limit(1);
    return row;
  }

  /**
   * Atomic: a partial failure would leave a row with isRoot=true but no admin
   * role/password, and findRootUser would then skip re-creation forever.
   * Bootstrap isn't a GraphQL mutation, so the transactional-mutations
   * interceptor doesn't cover it — wrap explicitly. (client is ALS-bound, so
   * the auth write below joins the same tx.)
   */
  async createRootUser(id: ID, email: string, passwordHash: string) {
    const userId = id as ID<'User'>;
    await this.drizzle.inTx(async () => {
      await this.drizzle.client.insert(users).values({
        id: userId,
        isRoot: true,
        status: 'Active',
        email,
        realFirstName: 'Root',
        realLastName: 'Admin',
        displayFirstName: 'Root',
        displayLastName: 'Admin',
      });
      await this.drizzle.client
        .insert(userGlobalRoles)
        .values({ userId, role: Role.Administrator });
      await this.auth.savePasswordHashOnUser(userId, passwordHash);
    });
  }

  /**
   * Idempotent on re-boot when the row already exists (id conflict → no-op).
   * Scope the conflict to the id only: if a *different* org already holds
   * this name, let the name unique-index violation surface rather than
   * silently no-op and leave config.defaultOrg.id pointing at no row.
   */
  async mergeDefaultOrg(id: ID, name: string) {
    await this.drizzle.client
      .insert(organizations)
      .values({ id: id as ID<'Organization'>, name })
      .onConflictDoNothing({ target: organizations.id });
  }

  async updateEmail(id: ID, email: string) {
    await this.drizzle.client
      .update(users)
      .set({ email })
      .where(eq(users.id, id as ID<'User'>));
  }
}

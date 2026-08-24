import { Injectable } from '@nestjs/common';
import { many, type Many } from '@seedcompany/common';
import { and, arrayOverlaps, eq, isNull } from 'drizzle-orm';
import { type ID, type PublicOf, ServerException } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { financialApprovers, users } from '~/core/drizzle/schema';
import { type ProjectType } from '../dto/project-type.enum';
import { type FinancialApprover, type SetFinancialApprover } from './dto';
import { type FinancialApproverRepository } from './financial-approver.repository';

@Injectable()
export class FinancialApproverDrizzleRepository implements PublicOf<FinancialApproverRepository> {
  constructor(private readonly db: DrizzleService) {}

  async read(types?: Many<ProjectType>) {
    const [first, ...rest] = types ? many(types) : [];
    if (types && first === undefined) {
      // An empty filter matches nothing — parity with the Neo4j/Gel arms,
      // where it becomes an intersection with the empty set.
      return [];
    }
    const rows = await this.hydrated().where(
      first !== undefined
        ? arrayOverlaps(financialApprovers.projectTypes, [first, ...rest])
        : undefined,
    );
    return rows.map(toDto);
  }

  async write(input: SetFinancialApprover) {
    if (input.projectTypes.length === 0) {
      await this.db.client
        .delete(financialApprovers)
        .where(eq(financialApprovers.userId, input.user));
      return null;
    }

    // The FK alone cannot enforce this: a soft-deleted user's row never
    // leaves, so the insert would succeed where the Neo4j arm's match on the
    // live `User` label finds nothing and throws. Same check, same error.
    const liveUser = await this.db.client
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, input.user), isNull(users.deletedAt)));
    if (!liveUser[0]) {
      throw new ServerException('Failed to set financial approver.');
    }

    await this.db.client
      .insert(financialApprovers)
      .values({ userId: input.user, projectTypes: input.projectTypes })
      .onConflictDoUpdate({
        target: financialApprovers.userId,
        set: { projectTypes: input.projectTypes },
      });

    const written = await this.hydrated().where(
      eq(financialApprovers.userId, input.user),
    );
    if (!written[0]) {
      throw new ServerException('Failed to set financial approver.');
    }
    return toDto(written[0]);
  }

  private hydrated() {
    return this.db.client
      .select({
        userId: financialApprovers.userId,
        email: users.email,
        projectTypes: financialApprovers.projectTypes,
      })
      .from(financialApprovers)
      .innerJoin(
        users,
        // Live users only — the Neo4j arm matches the live `User` label, so a
        // soft-deleted user's approver row disappears from read() there. This
        // also protects the workflow notifier (which emails read()'s output)
        // and the resolver's non-nullable user field (whose loader filters
        // deleted users and would throw NotFound).
        and(eq(users.id, financialApprovers.userId), isNull(users.deletedAt)),
      );
  }
}

const toDto = (row: {
  userId: ID<'User'>;
  email: string | null;
  projectTypes: readonly [ProjectType, ...ProjectType[]];
}): FinancialApprover => ({
  user: { id: row.userId, email: row.email },
  projectTypes: row.projectTypes,
});

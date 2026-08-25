import { Injectable } from '@nestjs/common';
import { many, type Many } from '@seedcompany/common';
import { and, arrayOverlaps, eq, isNull, sql } from 'drizzle-orm';
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
      // Deliberately not conditioned on the user being live, unlike the write
      // below. The Neo4j arm matches the live `User` label here too, so for a
      // soft-deleted user it deletes nothing and the row survives — but that
      // row is unreachable through read() on either engine, so matching Neo4j
      // would mean deliberately keeping data nothing can see. Removing it is
      // the better of two unobservable behaviours.
      await this.db.client
        .delete(financialApprovers)
        .where(eq(financialApprovers.userId, input.user));
      return null;
    }

    // Each value parameterized rather than inlined, and cast explicitly: the
    // column is `project_type[]`, and a bare array parameter arrives untyped.
    const typesLiteral = sql<
      readonly [ProjectType, ...ProjectType[]]
    >`array[${sql.join(
      input.projectTypes.map((type) => sql`${type}`),
      sql`, `,
    )}]::"project_type"[]`;

    // ONE statement, deliberately. The foreign key cannot carry this: soft
    // deletion never removes the user's row, so it is satisfied by a deleted
    // user. Checking liveness in a separate SELECT first leaves a window — a
    // user soft-deleted between the two statements gets an approver row
    // written anyway — where the Neo4j arm, a single match-then-merge, has no
    // such window. Selecting the row out of `users` closes it without needing
    // a lock or a surrounding transaction: no live user, no row to insert,
    // nothing written.
    //
    // Raw SQL rather than the query builder because drizzle's
    // insert-from-select generics reject a projection that mixes a column with
    // a SQL expression, which is exactly the shape wanted here.
    await this.db.client.execute(sql`
      insert into ${financialApprovers} ("user_id", "project_types")
      select ${users.id}, ${typesLiteral}
      from ${users}
      where ${users.id} = ${input.user} and ${users.deletedAt} is null
      on conflict ("user_id")
        do update set "project_types" = excluded."project_types"
    `);

    // This now covers the not-live case as well as a failed write, which is
    // why the liveness check above it is gone rather than merely moved:
    // hydrated() inner-joins live users, so a user who was never live (nothing
    // was written) and one deleted concurrently both land here, and raise the
    // same error the Neo4j arm raises when its match finds nothing.
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

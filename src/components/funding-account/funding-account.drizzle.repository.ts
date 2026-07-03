import { Injectable } from '@nestjs/common';
import { and, eq, isNull, type SQL } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  type PaginatedListType,
  type UnsecuredDto,
} from '~/common';
import {
  catchUniqueViolation,
  DrizzleDtoRepository,
  EMPTY_PAGE,
  resolveOrderBy,
  type SortMap,
} from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { departmentIdBlocks, fundingAccounts } from '~/core/drizzle/schema';
import { PolicyExecutor } from '../authorization/policy/executor/policy-executor';
import { ProjectType as Program } from '../project/dto/project-type.enum';
import {
  type CreateFundingAccount,
  FundingAccount,
  type FundingAccountListInput,
  type UpdateFundingAccount,
} from './dto';

const catchNameUnique = catchUniqueViolation(
  'name',
  'name',
  'FundingAccount with this name already exists.',
);

// Same formula as the Neo4j repo: the first 10 IDs of each 10k block are
// reserved, and the block is inclusive of its last ID.
const blockOfAccount = (accountNumber: number) => [
  {
    start: accountNumber * 10000 + 11,
    end: (accountNumber + 1) * 10000 - 1,
  },
];

@Injectable()
export class FundingAccountDrizzleRepository extends DrizzleDtoRepository<
  typeof fundingAccounts,
  FundingAccount
> {
  constructor(
    db: DrizzleService,
    private readonly executor: PolicyExecutor,
  ) {
    super(db, fundingAccounts, FundingAccount);
  }

  async create(
    input: CreateFundingAccount,
  ): Promise<UnsecuredDto<FundingAccount>> {
    const id = await generateId();
    const blockId = await generateId();
    await this.db.insert(departmentIdBlocks).values({
      id: blockId,
      range: blockOfAccount(input.accountNumber),
      programs: [Program.MomentumTranslation, Program.Internship],
    });
    await this.db
      .insert(fundingAccounts)
      .values({
        id,
        name: input.name,
        accountNumber: input.accountNumber,
        departmentIdBlockId: blockId,
      })
      .catch(catchNameUnique);
    return await this.readOne(id);
  }

  async update(
    changes: UpdateFundingAccount,
  ): Promise<UnsecuredDto<FundingAccount>> {
    const { id, ...fields } = changes;
    await this.updateColumns(id, {
      name: fields.name,
      accountNumber: fields.accountNumber,
    }).catch(catchNameUnique);
    if (fields.accountNumber != null) {
      const row = await this.db.query.fundingAccounts.findFirst({
        where: (fa) => eq(fa.id, id as ID<'FundingAccount'>),
        columns: { departmentIdBlockId: true },
      });
      if (row?.departmentIdBlockId) {
        await this.db
          .update(departmentIdBlocks)
          .set({ range: blockOfAccount(fields.accountNumber) })
          .where(eq(departmentIdBlocks.id, row.departmentIdBlockId));
      } else {
        const blockId = await generateId();
        await this.db.insert(departmentIdBlocks).values({
          id: blockId,
          range: blockOfAccount(fields.accountNumber),
          programs: [Program.MomentumTranslation, Program.Internship],
        });
        await this.updateColumns(id, { departmentIdBlockId: blockId });
      }
    }
    return await this.readOne(id);
  }

  async delete(id: ID): Promise<void> {
    await this.softDelete(id);
  }

  async list(
    input: FundingAccountListInput,
  ): Promise<PaginatedListType<UnsecuredDto<FundingAccount>>> {
    const conditions: SQL[] = [isNull(fundingAccounts.deletedAt)];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return EMPTY_PAGE;
    }

    const sortColumns = {
      name: fundingAccounts.name,
      accountNumber: fundingAccounts.accountNumber,
      createdAt: fundingAccounts.createdAt,
    } satisfies SortMap<keyof FundingAccount>;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: resolveOrderBy(input, sortColumns, fundingAccounts.name),
      page: input.page,
      count: input.count,
    });
    return {
      total,
      items: rows.map((row) => this.toDto(row)),
      hasMore,
    };
  }

  protected toDto(
    row: typeof fundingAccounts.$inferSelect,
  ): UnsecuredDto<FundingAccount> {
    // migration-todo: departmentIdBlock is deferred to the Project-domain
    // migration. The Neo4j repo links a DepartmentIdBlock node and the Gel
    // schema requires one, but the shared IdBlock representation (and its
    // ProjectType enum) belongs with Project. Nothing reads it in PG mode yet:
    // its only consumer, SetDepartmentId, is Neo4j-only. When ported, the block
    // is deterministic from accountNumber:
    //   range(accountNumber * 10000 + 11 .. (accountNumber + 1) * 10000 - 1)
    //   programs: [MomentumTranslation, Internship]
    return {
      id: row.id,
      __typename: 'FundingAccount',
      createdAt: DateTime.fromJSDate(row.createdAt),
      name: row.name,
      accountNumber: row.accountNumber,
    };
  }
}

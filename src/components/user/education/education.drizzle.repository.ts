import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  generateId,
  type ID,
  NotFoundException,
  type UnsecuredDto,
} from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { DrizzleDtoRepository } from '~/core/drizzle/dto.repository';
import { educations } from '~/core/drizzle/schema';
import {
  type CreateEducation,
  type Education,
  type EducationListInput,
  type UpdateEducation,
} from './dto';

@Injectable()
export class EducationDrizzleRepository extends DrizzleDtoRepository<
  typeof educations,
  Education
> {
  constructor(db: DrizzleService) {
    super(db, educations);
  }

  async create(input: CreateEducation): Promise<UnsecuredDto<Education>> {
    const id = await generateId();
    await this.db.insert(educations).values({
      id,
      userId: input.user,
      degree: input.degree,
      major: input.major,
      institution: input.institution,
    });
    return await this.readOne(id);
  }

  async update(changes: UpdateEducation): Promise<UnsecuredDto<Education>> {
    const { id, ...fields } = changes;
    await this.updateColumns(id, fields);
    return await this.readOne(id);
  }

  async getUserByEducationId(id: ID): Promise<{ id: ID<'User'> }> {
    const row = await this.db.query.educations.findFirst({
      where: (education) => eq(education.id, id),
      columns: { userId: true },
    });
    if (!row) {
      throw new NotFoundException(
        'Could not find user associated with education',
      );
    }
    return { id: row.userId };
  }

  async list(input: EducationListInput): Promise<{
    items: Array<UnsecuredDto<Education>>;
    total: number;
    hasMore: boolean;
  }> {
    const conditions = [isNull(educations.deletedAt)];
    if (input.filter?.userId)
      conditions.push(eq(educations.userId, input.filter.userId));

    const dir = input.order === 'ASC' ? asc : desc;
    const sortColumns = {
      degree: educations.degree,
      major: educations.major,
      institution: educations.institution,
    } satisfies Partial<Record<keyof Education, unknown>>;
    const orderCol =
      sortColumns[input.sort as keyof typeof sortColumns] ??
      educations.institution;

    const { rows, total, hasMore } = await this.paginatedSelect({
      predicate: and(...conditions),
      orderBy: [dir(orderCol)],
      page: input.page,
      count: input.count,
    });
    return { items: rows.map((row) => this.toDto(row)), total, hasMore };
  }

  protected toDto(
    row: typeof educations.$inferSelect,
  ): UnsecuredDto<Education> {
    return {
      id: row.id,
      __typename: 'Education',
      createdAt: DateTime.fromJSDate(row.createdAt),
      degree: row.degree,
      major: row.major,
      institution: row.institution,
    };
  }
}

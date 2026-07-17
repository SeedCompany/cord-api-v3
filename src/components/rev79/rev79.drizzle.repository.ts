import { Injectable } from '@nestjs/common';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { engagements, languages, projects } from '~/core/drizzle/schema';

@Injectable()
export class Rev79DrizzleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  protected get db() {
    return this.drizzle.client;
  }

  async findProjectsByRev79Id(
    rev79ProjectId: string,
  ): Promise<ReadonlyArray<{ id: ID<'Project'> }>> {
    return await this.db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.rev79ProjectId, rev79ProjectId),
          isNull(projects.deletedAt),
        ),
      );
  }

  async findCommunitiesByRev79ProjectId(
    projectId: ID<'Project'>,
  ): Promise<ReadonlyArray<{ id: string; name: string }>> {
    const rows = await this.db
      .select({ id: engagements.rev79CommunityId, name: languages.name })
      .from(engagements)
      .innerJoin(languages, eq(engagements.languageId, languages.id))
      .where(
        and(
          eq(engagements.projectId, projectId),
          isNotNull(engagements.rev79CommunityId),
          isNull(engagements.deletedAt),
        ),
      );
    return rows.map((row) => ({ id: row.id!, name: row.name }));
  }

  async findEngagementsByRev79CommunityId(
    projectId: ID<'Project'>,
    rev79CommunityId: string,
  ): Promise<ReadonlyArray<{ id: ID<'LanguageEngagement'> }>> {
    const rows = await this.db
      .select({ id: engagements.id })
      .from(engagements)
      .where(
        and(
          eq(engagements.projectId, projectId),
          eq(engagements.rev79CommunityId, rev79CommunityId),
          isNull(engagements.deletedAt),
        ),
      );
    return rows as Array<{ id: ID<'LanguageEngagement'> }>;
  }
}

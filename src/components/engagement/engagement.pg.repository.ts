import { Injectable } from '@nestjs/common';
import { Node } from 'cypher-query-builder';
import { some } from 'lodash';
import { DateTime } from 'luxon';
import { Without } from 'type-fest/source/merge-exclusive';
import {
  generateId,
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  ObjectView,
  PaginatedListType,
  PublicOf,
  ResourceShape,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import { BaseNode } from '../../core/database/results';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { FileId } from '../file';
import { ProjectType } from '../project';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  EngagementListInput,
  EngagementStatus,
  InternshipEngagement,
  LanguageEngagement,
  OngoingEngagementStatuses,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import {
  EngagementRepository,
  LanguageOrEngagementId,
} from './engagement.repository';

@Injectable()
export class PgEngagementRepository implements PublicOf<EngagementRepository> {
  constructor(private readonly pg: Pg) {}

  private getQueryByType(type: ProjectType, isProjectId: boolean) {
    const engagementDetails = `
    SELECT
        id, project, status, complete_date as "completeDate",
        disbursement_complete_date as "disbursementCompleteDate", start_date as "startDate",
        end_date as "endDate", start_date_override as "startDateOverride", 
        end_date_override as "endDateOverride", initial_end_date as "initialEndDate", 
        last_suspended_at as "lastSuspendedAt", last_reactivated_at as "lastReactivatedAt",
        status_modified_at as "statusModifiedAt", modified_at as "modifiedAt",
    `;

    const languageEngagementQuery = `
    ${engagementDetails}
        language, is_first_scripture as "firstScripture", is_luke_partnership as "lukePartnership",
        is_open_to_investor_visit as "openToInvestorVisit", paratext_registry as "paratextRegistryId",
        historic_goal as "historicGoal", pnp
    FROM sc.language_engagements
    WHERE ${isProjectId ? 'project' : 'id'} = $1; 
    `;

    const internshipEngagmentQuery = `
    ${engagementDetails}
        country_of_origin as "countryOfOrigin", intern, mentor, position, methodologies, 
        growth_plan as "growthPlan" 
    FROM sc.internship_engagements
    WHERE  ${isProjectId ? 'project' : 'id'} = $1;
    `;

    return type === ProjectType.Translation
      ? languageEngagementQuery
      : internshipEngagmentQuery;
  }

  async readOne(
    id: ID,
    _session?: Session,
    _view?: ObjectView
  ): Promise<
    UnsecuredDto<
      | (Without<LanguageEngagement, InternshipEngagement> &
          InternshipEngagement)
      | (Without<InternshipEngagement, LanguageEngagement> & LanguageEngagement)
    >
  > {
    const type = await this.getProjectTypeByEngagement(id);
    const query = this.getQueryByType(type, false);
    const rows = await this.pg.query<
      UnsecuredDto<
        | (Without<LanguageEngagement, InternshipEngagement> &
            InternshipEngagement)
        | (Without<InternshipEngagement, LanguageEngagement> &
            LanguageEngagement)
      >
    >(query, [id]);

    return rows[0];
  }

  async readMany(
    ids: readonly ID[],
    _session?: Session,
    _view?: ObjectView
  ): Promise<
    ReadonlyArray<
      UnsecuredDto<
        | (Without<LanguageEngagement, InternshipEngagement> &
            InternshipEngagement)
        | (Without<InternshipEngagement, LanguageEngagement> &
            LanguageEngagement)
      >
    >
  > {
    const rows = await Promise.all(
      ids.map(async (id) => {
        const type = await this.getProjectTypeByEngagement(id);
        const query = this.getQueryByType(type, false);
        return await this.pg.query<
          UnsecuredDto<
            | (Without<LanguageEngagement, InternshipEngagement> &
                InternshipEngagement)
            | (Without<InternshipEngagement, LanguageEngagement> &
                LanguageEngagement)
          >
        >(query, [id]);
      })
    );

    return rows.flat();
  }

  async createLanguageEngagement(
    input: CreateLanguageEngagement,
    _changeset?: ID
  ): Promise<{ id: ID; pnpId: never }> {
    const type = await this.getProjectType(input.projectId);

    if (type !== ProjectType.Translation) {
      throw new Error('Project must be of Translation type');
    }

    const pnpId = (await generateId()) as FileId;
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.language_engagements(
          project, language, is_open_to_investor_visit, disbursement_complete_date,
          complete_date, end_date_override, is_first_scripture, is_luke_partnership, 
          paratext_registry, start_date_override, status, status_modified_at,
          historic_goal, created_by, modified_by, owning_person, owning_group)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        input.projectId,
        input.languageId,
        input.openToInvestorVisit,
        input.disbursementCompleteDate,
        input.completeDate,
        input.endDateOverride,
        input.firstScripture,
        input.lukePartnership,
        input.paratextRegistryId,
        input.startDateOverride,
        input.status || EngagementStatus.InDevelopment,
        DateTime.local(),
        input.historicGoal,
      ]
    );

    if (!id) {
      throw new ServerException('Failed to create language engagement');
    }

    return { id, pnpId };
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    _changeset?: ID
  ): Promise<{ id: ID; growthPlanId: never }> {
    const type = await this.getProjectType(input.projectId);

    if (type !== ProjectType.Internship) {
      throw new Error('Project must be of Internship type');
    }

    const growthPlanId = (await generateId()) as FileId;
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.internship_engagements(
          project, complete_date, country_of_origin, disbursement_complete_date,
          end_date_override, intern, mentor, methodologies, position, 
          start_date_override, status, status_modified_at, created_by, 
          modified_by, owning_person, owning_group)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        input.projectId,
        input.completeDate,
        input.countryOfOriginId,
        input.disbursementCompleteDate,
        input.endDateOverride,
        input.internId,
        input.mentorId,
        input.methodologies,
        input.position,
        input.startDateOverride,
        input.status || EngagementStatus.InDevelopment,
        DateTime.local(),
      ]
    );

    if (!id) {
      throw new ServerException('Failed to create internship engagement');
    }

    return { id, growthPlanId };
  }

  async updateMentor(id: ID, mentorId: ID): Promise<void> {
    await this.pg.query(
      `
      UPDATE sc.internship_engagements SET mentor = (SELECT id FROM admin.people WHERE id = $1) 
      WHERE id = $2;
      `,
      [mentorId, id]
    );
  }

  async updateCountryOfOrigin(id: ID, countryOfOriginId: ID): Promise<void> {
    await this.pg.query(
      `
      UPDATE sc.internship_engagements SET country_of_origin = (SELECT id FROM common.locations WHERE id = $1)
      WHERE id = $2;
      `,
      [countryOfOriginId, id]
    );
  }

  async listAllByProjectId(
    projectId: ID,
    _session?: Session
  ): Promise<
    ReadonlyArray<
      UnsecuredDto<
        | (Without<LanguageEngagement, InternshipEngagement> &
            InternshipEngagement)
        | (Without<InternshipEngagement, LanguageEngagement> &
            LanguageEngagement)
      >
    >
  > {
    const type = await this.getProjectType(projectId);

    if (!type) {
      throw new NotFoundException('Could not find project');
    }

    const query = this.getQueryByType(type, true);
    const rows = await this.pg.query<
      UnsecuredDto<
        | (Without<LanguageEngagement, InternshipEngagement> &
            InternshipEngagement)
        | (Without<InternshipEngagement, LanguageEngagement> &
            LanguageEngagement)
      >
    >(query, [projectId]);

    return rows;
  }

  private async getProjectType(projectId: ID) {
    const [{ type }] = await this.pg.query<{ type: ProjectType }>(
      `
      SELECT type FROM sc.projects WHERE id = $1;
      `,
      [projectId]
    );

    return type;
  }

  private async getProjectTypeByEngagement(id: ID) {
    const [{ type }] = await this.pg.query<{ type: ProjectType }>(
      `
      SELECT p.type 
      FROM sc.language_engagements le, sc.internship_engagements ie, sc.projects p 
      WHERE p.id = le.project AND le.id = $1 OR p.id = ie.project AND ie.id = $1;
      `,
      [id]
    );

    return type;
  }

  async getOngoingEngagementIds(projectId: ID): Promise<ID[]> {
    const type = await this.getProjectType(projectId);
    if (!type) {
      throw new NotFoundException('Could not find project');
    }

    const rows = await this.pg.query<{ id: ID }>(
      `
      SELECT id 
      FROM ${
        type === ProjectType.Translation
          ? 'sc.language_engagements'
          : 'sc.internship_engagements'
      }
      WHERE project = $1 AND status = ANY($2::common.engagement_status[]);
      `,
      [projectId, OngoingEngagementStatuses]
    );

    return rows.map((r) => r.id);
  }

  async doesLanguageHaveExternalFirstScripture({
    engagementId,
    languageId,
  }: LanguageOrEngagementId): Promise<boolean> {
    const [{ hasExternalFirstScripture }] = engagementId
      ? await this.pg.query<{ hasExternalFirstScripture: boolean | null }>(
          `SELECT l.has_external_first_scripture as "hasExternalFirstScripture" 
          FROM sc.language_engagements le, sc.languages l WHERE le.id = $1 AND le.language = l.id;`,
          [engagementId]
        )
      : await this.pg.query<{ hasExternalFirstScripture: boolean | null }>(
          `SELECT has_external_first_scripture as "hasExternalFirstScripture" FROM sc.languages WHERE id = $1`,
          [languageId]
        );

    return !!hasExternalFirstScripture;
  }

  async doOtherEngagementsHaveFirstScripture({
    engagementId,
    languageId,
  }: LanguageOrEngagementId): Promise<boolean> {
    const rows = engagementId
      ? await this.pg.query<{ firstScripture: boolean }>(
          `
          SELECT is_first_scripture as "firstScripture" FROM sc.language_engagements 
          WHERE language = (SELECT l.id FROM sc.language_engagements le, sc.languages l 
                            WHERE le.id = $1 AND le.language = l.id);`,
          [engagementId]
        )
      : await this.pg.query<{ firstScripture: boolean }>(
          `
          SELECT is_first_scripture as "firstScripture" FROM sc.language_engagements
          WHERE language = $1;
`,
          [languageId]
        );

    return some(rows, { firstScripture: true });
  }

  async list(
    input: EngagementListInput,
    _session?: Session,
    _changeset?: ID,
    _limitedScope?: AuthSensitivityMapping
  ): Promise<
    PaginatedListType<
      UnsecuredDto<
        | (Without<LanguageEngagement, InternshipEngagement> &
            InternshipEngagement)
        | (Without<InternshipEngagement, LanguageEngagement> &
            LanguageEngagement)
      >
    >
  > {
    // TODO: Match AuthSensitivityMapping and filters
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
        SELECT sum(total) as count
        FROM
	        (SELECT count(*) as total
		      FROM sc.language_engagements
		      UNION 
	        SELECT count(*) as total
		      FROM sc.internship_engagements) engagements;
        `
    );

    const rows = await this.pg.query<
      UnsecuredDto<
        | (Without<LanguageEngagement, InternshipEngagement> &
            InternshipEngagement)
        | (Without<InternshipEngagement, LanguageEngagement> &
            LanguageEngagement)
      >
    >(
      `
      SELECT
          id, project, status, complete_date as "completeDate",
          disbursement_complete_date as "disbursementCompleteDate", start_date as "startDate",
          end_date as "endDate", start_date_override as "startDateOverride",
          end_date_override as "endDateOverride", initial_end_date as "initialEndDate",
          last_suspended_at as "lastSuspendedAt", last_reactivated_at as "lastReactivatedAt",
          status_modified_at as "statusModifiedAt", modified_at as "modifiedAt",
          language, is_first_scripture as "firstScripture", is_luke_partnership as "lukePartnership",
          is_open_to_investor_visit as "openToInvestorVisit", paratext_registry as "paratextRegistryId",
          historic_goal as "historicGoal", pnp,
		      null as "countryOfOrigin", null as intern, null as mentor, null as position, null as methodologies, 
		      null as "growthPlan"
      FROM sc.language_engagements
      UNION
      SELECT
          id, project, status, complete_date as "completeDate",
          disbursement_complete_date as "disbursementCompleteDate", start_date as "startDate",
          end_date as "endDate", start_date_override as "startDateOverride",
          end_date_override as "endDateOverride", initial_end_date as "initialEndDate",
          last_suspended_at as "lastSuspendedAt", last_reactivated_at as "lastReactivatedAt",
          status_modified_at as "statusModifiedAt", modified_at as "modifiedAt",
          null, null, null, null, null, null, null,
		      country_of_origin as "countryOfOrigin", intern, mentor, position, methodologies, 	
		      growth_plan as "growthPlan"
      FROM sc.internship_engagements
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 25} OFFSET ${offset ?? 10};
      `
    );

    const engagementList: PaginatedListType<
      UnsecuredDto<
        | (Without<LanguageEngagement, InternshipEngagement> &
            InternshipEngagement)
        | (Without<InternshipEngagement, LanguageEngagement> &
            LanguageEngagement)
      >
    > = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return engagementList;
  }

  async updateLanguageProperties(
    object:
      | LanguageEngagement
      | UnsecuredDto<LanguageEngagement>
      | UpdateLanguageEngagement,
    _changes?: DbChanges<LanguageEngagement>,
    _changeset?: ID
  ): Promise<void> {
    const { id, ...changes } = object;
    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        const regExpList = [/first/, /luke/, /open/];

        return label.endsWith('_id')
          ? `${label.replace('_id', '')} = '${value as string}'`
          : regExpList.some((rx) => rx.test(label))
          ? `${'is_'.concat(label)} = ${value as string}`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.language_engagements SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = $1
      `,
      [id]
    );
  }

  async updateInternshipProperties(
    object:
      | InternshipEngagement
      | UnsecuredDto<InternshipEngagement>
      | UpdateInternshipEngagement,
    _changes?: DbChanges<InternshipEngagement>,
    _changeset?: ID
  ): Promise<void> {
    const { id, ...changes } = object;
    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label.endsWith('_id')
          ? `${label.replace('_id', '')} = '${value as string}'`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.internship_engagements SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = $1
      `,
      [id]
    );
  }

  getActualLanguageChanges: <
    TResource extends MaybeUnsecuredInstance<typeof LanguageEngagement>,
    Changes extends ChangesOf<TResource>
  >(
    existingObject: TResource,
    changes: Changes & Record<any, any>
  ) => Partial<any>;

  getActualInternshipChanges: <
    TResource extends MaybeUnsecuredInstance<typeof InternshipEngagement>,
    Changes extends ChangesOf<TResource>
  >(
    existingObject: TResource,
    changes: Changes & Record<any, any>
  ) => Partial<any>;

  verifyRelationshipEligibility(
    _projectId: ID,
    _otherId: ID,
    _isTranslation: boolean,
    _property: 'language' | 'intern',
    _changeset?: ID
  ): Promise<
    | {
        project?: Node<{ type: ProjectType }> | undefined;
        other?: Node | undefined;
        engagement?: Node | undefined;
      }
    | undefined
  > {
    throw new Error('Method not implemented.');
  }

  isUnique(_value: string, _label: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getBaseNode(
    _id: ID,
    _label?: string | ResourceShape<any>
  ): Promise<BaseNode | undefined> {
    throw new Error('Method not implemented.');
  }
  updateRelation(
    _relationName: string,
    _otherLabel: string,
    _id: ID,
    _otherId: ID | null,
    _label?: string
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  checkDeletePermission(_id: ID, _session: ID | Session): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  deleteNode(_objectOrId: ID | { id: ID }, _changeset?: ID): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

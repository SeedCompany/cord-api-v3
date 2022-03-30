import { Injectable } from '@nestjs/common';
import { Node } from 'cypher-query-builder';
import { isNil, omitBy, some } from 'lodash';
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
  UpdateEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import {
  EngagementRepository,
  LanguageOrEngagementId,
} from './engagement.repository';

type EngagementType = 'Language' | 'Internship';

@Injectable()
export class PgEngagementRepository implements PublicOf<EngagementRepository> {
  constructor(private readonly pg: Pg) {}

  private getQueryByType(engType: EngagementType, isProjectId?: boolean) {
    const engagementDetails = `
    SELECT 
        e.id, e.sc_projects_id as "project", e.status, e.ceremony, e.complete_date as "completeDate",
        e.disbursement_complete_date as "disbursementCompleteDate", e.start_date as "startDate",
        e.end_date as "endDate", e.start_date_override as "startDateOverride", e.sensitivity,
        e.end_date_override as "endDateOverride", e.initial_end_date as "initialEndDate",
        e.last_suspended_at as "lastSuspendedAt", e.last_reactivated_at as "lastReactivatedAt",
        e.status_modified_at as "statusModifiedAt", e.modified_at as "modifiedAt", 
    `;

    const languageEngagementQuery = `
    ${engagementDetails}
    le.common_languages_id as language, le.is_open_to_investor_visit as "openToInvestorVisit",
    le.is_first_scripture as "firstScripture", le.is_luke_partnership as "lukePartnership",
    le.paratext_registry as "paratextRegistryId", historic_goal as "historicGoal" 
    FROM sc.engagements e
	  JOIN sc.language_engagements le ON le.id = e.id AND ${
      isProjectId ? 'e.sc_projects_id' : 'e.id'
    } = $1`;

    const internshipEngagmentQuery = `
    ${engagementDetails}
    ie.country_of_origin_common_locations_id as "countryOfOrigin", ie.intern_admin_people_id as intern, 
    ie.position, ie.methodologies
    FROM sc.engagements e
	  JOIN sc.internship_engagements ie ON ie.id = e.id AND ${
      isProjectId ? 'e.sc_projects_id' : 'e.id'
    } = $1
    `;

    return engType === 'Language'
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
    const type = await this.getEngagementType(id);
    const query = this.getQueryByType(type);
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
        const type = await this.getEngagementType(id);
        const query = this.getQueryByType(type);
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
      throw new Error('Project must be of Transalation type');
    }
    const pnpId = (await generateId()) as FileId;
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      WITH eng_id AS (
        INSERT INTO sc.engagements(
            sc_projects_id, engagement_type, status, status_modified_at, complete_date,
            disbursement_complete_date, end_date_override, start_date_override,
            created_by_admin_people_id, modified_by_admin_people_id, 
            owning_person_admin_people_id, owning_group_admin_groups_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
        RETURNING id
      )
      INSERT INTO sc.language_engagements(
          id, common_languages_id, is_open_to_investor_visit,
          is_first_scripture, is_luke_partnership, paratext_registry,
          historic_goal, created_by_admin_people_id, modified_by_admin_people_id, 
          owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES ((SELECT id FROM eng_id), $9, $10, $11, $12, $13, $14, 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        input.projectId,
        'Language',
        input.status || EngagementStatus.InDevelopment,
        DateTime.local(),
        input.completeDate,
        input.disbursementCompleteDate,
        input.endDateOverride,
        input.startDateOverride,
        input.languageId,
        input.openToInvestorVisit,
        input.firstScripture,
        input.lukePartnership,
        input.paratextRegistryId,
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
      WITH eng_id AS (
        INSERT INTO sc.engagements(
            sc_projects_id, engagement_type, status, status_modified_at, complete_date,
            disbursement_complete_date, end_date_override, start_date_override,
            created_by_admin_people_id, modified_by_admin_people_id, 
            owning_person_admin_people_id, owning_group_admin_groups_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
        RETURNING id
      )
      INSERT INTO sc.internship_engagements(
        id, country_of_origin_common_locations_id, intern_admin_people_id,
        mentor_admin_people_id, methodologies, position, created_by_admin_people_id, 
        modified_by_admin_people_id, owning_person_admin_people_id, owning_group_admin_groups_id) 
      VALUES((SELECT id FROM eng_id), $9, $10, $11, $12, $13,
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        input.projectId,
        'Internship',
        input.status || EngagementStatus.InDevelopment,
        DateTime.local(),
        input.completeDate,
        input.disbursementCompleteDate,
        input.endDateOverride,
        input.startDateOverride,
        input.countryOfOriginId,
        input.internId,
        input.mentorId,
        input.methodologies,
        input.position,
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
      UPDATE sc.internship_engagements SET mentor_admin_people_id = (SELECT id FROM admin.people WHERE id = $1) 
      WHERE id = $2;
      `,
      [mentorId, id]
    );
  }

  async updateCountryOfOrigin(id: ID, countryOfOriginId: ID): Promise<void> {
    await this.pg.query(
      `
      UPDATE sc.internship_engagements SET country_of_origin_common_locations_id = (SELECT id FROM common.locations WHERE id = $1)
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
    const type = await this.getEngagementTypeByProjectId(projectId);

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

  private async getEngagementTypeByProjectId(projectId: ID) {
    const [type] = await this.pg.query<EngagementType>(
      `
      SELECT DISTINCT engagement_type FROM sc.engagements WHERE sc_projects_id = $1;
      `,
      [projectId]
    );

    return type;
  }

  private async getEngagementType(id: ID) {
    const [{ type }] = await this.pg.query<{ type: EngagementType }>(
      'SELECT engagement_type as type FROM sc.engagements WHERE id = $1;',
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
      SELECT id FROM sc.engagements WHERE sc_projects_id = $1 AND status = ANY($2::common.engagement_status[]);
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
          FROM sc.language_engagements le, sc.languages l WHERE le.id = $1 AND le.common_languages_id = l.id;`,
          [engagementId]
        )
      : await this.pg.query<{ hasExternalFirstScripture: boolean | null }>(
          `SELECT has_external_first_scripture as "hasExternalFirstScripture" FROM sc.languages WHERE id = $1;`,
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
          WHERE common_languages_id = 
              (SELECT l.id FROM sc.language_engagements le, sc.languages l 
               WHERE le.id = $1 AND le.common_languages_id = l.id);`,
          [engagementId]
        )
      : await this.pg.query<{ firstScripture: boolean }>(
          `
          SELECT is_first_scripture as "firstScripture" FROM sc.language_engagements
          WHERE common_languages_id = $1;
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
      'SELECT count(*) FROM sc.engagements;'
    );

    const engagements = await this.pg.query<{ id: ID }>(
      `
      SELECT id FROM sc.engagements
      ORDER BY created_at ${input.order}
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );

    const rows = await Promise.all(
      engagements.map(async (row) => {
        return await this.readOne(row.id);
      })
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

  async update(input: UpdateEngagement) {
    const { id, ...rest } = input;
    const changes = omitBy(rest, isNil);

    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label === 'status'
          ? `status = '${
              value as string
            }', status_modified_at = CURRENT_TIMESTAMP`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.engagements SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
      [id]
    );
  }

  async updateLanguageProperties(
    object:
      | LanguageEngagement
      | UnsecuredDto<LanguageEngagement>
      | UpdateLanguageEngagement,
    _changes?: DbChanges<LanguageEngagement>,
    _changeset?: ID
  ): Promise<void> {
    const {
      id,
      completeDate,
      disbursementCompleteDate,
      startDateOverride,
      endDateOverride,
      initialEndDate,
      status,
      methodology,
      ...changes
    } = object as UpdateLanguageEngagement;
    const regExpList = [/first/, /luke/, /open/];

    await this.update({
      id,
      completeDate,
      disbursementCompleteDate,
      startDateOverride,
      endDateOverride,
      initialEndDate,
      status,
    });

    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

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
      modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
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
    const {
      id,
      completeDate,
      disbursementCompleteDate,
      startDateOverride,
      endDateOverride,
      initialEndDate,
      status,
      ...changes
    } = object as UpdateLanguageEngagement;

    await this.update({
      id,
      completeDate,
      disbursementCompleteDate,
      startDateOverride,
      endDateOverride,
      initialEndDate,
      status,
    });

    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label === 'mentor_id'
          ? `mentor_admin_people_id = '${value as string}'`
          : label === 'country_of_origin_id'
          ? `country_of_origin_common_locations_id = '${value as string}'`
          : label === 'methodologies'
          ? `methodologies = ARRAY['${
              value.join("','") as string
            }']::common.product_methodologies[]`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.internship_engagements SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
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

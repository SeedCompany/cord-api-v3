import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { Without } from 'type-fest/source/merge-exclusive';
import {
  CalendarDate,
  ID,
  NotFoundException,
  PaginatedListType,
  PublicOf,
  Resource,
  ResourceShape,
  Sensitivity,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { Pg } from '../../core';
import { DbChanges } from '../../core/database/changes';
import { BaseNode, DbPropsOfDto } from '../../core/database/results';
import { Role } from '../authorization';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { ReportPeriod } from '../periodic-report';
import {
  CreateProject,
  InternshipProject,
  ProjectListInput,
  ProjectStatus,
  ProjectStep,
  ProjectType,
  stepToStatus,
  TranslationProject,
  UpdateProject,
} from './dto';
import { ProjectRepository } from './project.repository';

@Injectable()
export class PgProjectRepository implements PublicOf<ProjectRepository> {
  constructor(private readonly pg: Pg) {}

  async create(input: CreateProject): Promise<ID> {
    // TODO: Add ownning_organization
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.projects (name, type, primary_location, marketing_location,
                              field_region, mou_start, mou_end, estimated_submission,
                              step, step_changed_at, status, sensitivity, tags, preset_inventory, 
                              created_by, modified_by, owning_person, owning_group)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, $10, $11, $12, $13, 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        input.name,
        input.type,
        input.primaryLocationId,
        input.marketingLocationId,
        input.fieldRegionId,
        input.mouStart,
        input.mouEnd,
        input.estimatedSubmission,
        input.step,
        stepToStatus(input.step ?? ProjectStep.EarlyConversations),
        input.sensitivity,
        input.tags,
        input.presetInventory,
      ]
    );

    if (!id) {
      throw new ServerException('Failed to create project');
    }

    return id;
  }

  getRoles(_session: Session): Promise<Role[]> {
    throw new Error('Method not implemented.');
  }
  async readOne(
    id: ID,
    _userId: ID,
    _changeset?: ID
  ): Promise<
    UnsecuredDto<
      | (Without<TranslationProject, InternshipProject> & InternshipProject)
      | (Without<InternshipProject, TranslationProject> & TranslationProject)
    >
  > {
    const rows = await this.pg.query<
      UnsecuredDto<
        | (Without<TranslationProject, InternshipProject> & InternshipProject)
        | (Without<InternshipProject, TranslationProject> & TranslationProject)
      >
    >(
      `
      SELECT id, type, sensitivity, step, status, primary_location as "primaryLocation", 
             marketing_location as "marketingLocations", field_region as "fieldRegion",
             owning_organization as "owningOrganization", mou_start as "mouStart",
             mou_end as "mouEnd", step_changed_at as "stepChangedAt", 
             estimated_submission as "estimatedSubmission", modified_at as "modifiedAt",
             tags, preset_inventory as "presetInventory", created_at as "createdAt"
      FROM sc.projects
      WHERE id = $1;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find project ${id}`);
    }

    return rows[0];
  }

  async readMany(
    ids: readonly ID[],
    _session: Session,
    _changeset?: ID
  ): Promise<
    ReadonlyArray<
      UnsecuredDto<
        | (Without<TranslationProject, InternshipProject> & InternshipProject)
        | (Without<InternshipProject, TranslationProject> & TranslationProject)
      >
    >
  > {
    const rows = await this.pg.query<
      UnsecuredDto<
        | (Without<TranslationProject, InternshipProject> & InternshipProject)
        | (Without<InternshipProject, TranslationProject> & TranslationProject)
      >
    >(
      `
      SELECT id, type, sensitivity, step, status, primary_location as "primaryLocation", 
             marketing_location as "marketingLocations", field_region as "fieldRegion",
             owning_organization as "owningOrganization", mou_start as "mouStart",
             mou_end as "mouEnd", step_changed_at as "stepChangedAt", 
             estimated_submission as "estimatedSubmission", modified_at as "modifiedAt", 
             tags, preset_inventory as "presetInventory", created_at as "createdAt"
      FROM sc.projects
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  async list(
    input: ProjectListInput,
    _session: Session,
    _limitedScope?: AuthSensitivityMapping
  ): Promise<
    PaginatedListType<
      UnsecuredDto<
        | (Without<TranslationProject, InternshipProject> & InternshipProject)
        | (Without<InternshipProject, TranslationProject> & TranslationProject)
      >
    >
  > {
    // TODO: Match AuthSensitivityMapping and filters
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM sc.projects;
      `
    );

    const rows = await this.pg.query<
      UnsecuredDto<
        | (Without<TranslationProject, InternshipProject> & InternshipProject)
        | (Without<InternshipProject, TranslationProject> & TranslationProject)
      >
    >(
      `
      SELECT id, type, sensitivity, step, status, primary_location as "primaryLocation", 
             marketing_location as "marketingLocations", field_region as "fieldRegion",
             owning_organization as "owningOrganization", mou_start as "mouStart",
             mou_end as "mouEnd", step_changed_at as "stepChangedAt", 
             estimated_submission as "estimatedSubmission", modified_at as "modifiedAt", 
             tags, preset_inventory as "presetInventory", created_at as "created_At"
      FROM sc.projects
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 25} OFFSET ${offset ?? 10};
      `
    );

    const projectList: PaginatedListType<
      UnsecuredDto<
        | (Without<TranslationProject, InternshipProject> & InternshipProject)
        | (Without<InternshipProject, TranslationProject> & TranslationProject)
      >
    > = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return projectList;
  }

  async update(input: UpdateProject) {
    const { id, ...changes } = input;
    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label.endsWith('_id')
          ? `${label.replace('_id', '')} = '${value as string}'`
          : label === 'tags'
          ? `tags = ARRAY['${value.join("','") as string}']`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.projects SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = $1
      `,
      [id]
    );
  }

  async delete(id: ID) {
    // TODO: Check project_members, partnerships, engagements, budgets and so on
    await this.pg.query('DELETE FROM sc.projects WHERE id = $1', [id]);
  }

  async isUnique(value: string, _label?: string): Promise<boolean> {
    const [{ exists }] = await this.pg.query<{ exists: boolean }>(
      `
      SELECT EXISTS(SELECT name FROM sc.projects WHERE name = $1)
      `,
      [value]
    );

    return !exists;
  }

  getMembershipRoles(
    _projectId:
      | ID
      | (Without<TranslationProject, InternshipProject> & InternshipProject)
      | (Without<InternshipProject, TranslationProject> & TranslationProject),
    _session: Session
  ): Promise<{ memberRoles: Role[][] } | undefined> {
    throw new Error('Method not implemented.');
  }

  getActualChanges(
    _currentProject: UnsecuredDto<
      | (Without<TranslationProject, InternshipProject> & InternshipProject)
      | (Without<InternshipProject, TranslationProject> & TranslationProject)
    >,
    _input: UpdateProject
  ): Partial<
    Omit<
      {
        status?: ProjectStatus | undefined;
        id: ID;
        name?: string | undefined;
        primaryLocationId?: ID | null | undefined;
        marketingLocationId?: ID | null | undefined;
        fieldRegionId?: ID | null | undefined;
        mouStart?: CalendarDate | null | undefined;
        mouEnd?: CalendarDate | null | undefined;
        initialMouEnd?: CalendarDate | null | undefined;
        estimatedSubmission?: CalendarDate | null | undefined;
        step?: ProjectStep | undefined;
        sensitivity?: Sensitivity | undefined;
        tags?: string[] | undefined;
        financialReportReceivedAt?: DateTime | undefined;
        financialReportPeriod?: ReportPeriod | undefined;
        presetInventory?: boolean | undefined;
      },
      keyof Resource
    > &
      (
        | Pick<
            UnsecuredDto<
              Without<TranslationProject, InternshipProject> & InternshipProject
            >,
            'modifiedAt'
          >
        | Pick<
            UnsecuredDto<
              Without<InternshipProject, TranslationProject> &
                TranslationProject
            >,
            'modifiedAt'
          >
      )
  > {
    throw new Error('Method not implemented.');
  }

  updateProperties(
    _currentProject: UnsecuredDto<
      | (Without<TranslationProject, InternshipProject> & InternshipProject)
      | (Without<InternshipProject, TranslationProject> & TranslationProject)
    >,
    _simpleChanges: DbChanges<TranslationProject | InternshipProject>,
    _changeset?: ID
  ): Promise<
    UnsecuredDto<
      | (Without<TranslationProject, InternshipProject> & InternshipProject)
      | (Without<InternshipProject, TranslationProject> & TranslationProject)
    >
  > {
    throw new Error('Method not implemented.');
  }
  updateRelation(
    _relationName: string,
    _otherLabel: string,
    _id: ID,
    _otherId: ID | null
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }

  permissionsForListProp(
    _prop: string,
    _id: ID,
    _session: Session
  ): Promise<{ canRead: boolean; canCreate: boolean }> {
    throw new Error('Method not implemented.');
  }

  getChangesetProps(
    _changeset: ID
  ): Promise<
    | (Partial<
        DbPropsOfDto<
          | (Without<TranslationProject, InternshipProject> & InternshipProject)
          | (Without<InternshipProject, TranslationProject> &
              TranslationProject)
        >
      > & { id: ID; createdAt: DateTime; type: ProjectType })
    | undefined
  > {
    throw new Error('Method not implemented.');
  }

  getBaseNode(
    _id: ID,
    _label?: string | ResourceShape<any>
  ): Promise<BaseNode | undefined> {
    throw new Error('Method not implemented.');
  }
  checkDeletePermission(_id: ID, _session: Session | ID): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  deleteNode(_objectOrId: ID | { id: ID }, _changeset?: ID): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

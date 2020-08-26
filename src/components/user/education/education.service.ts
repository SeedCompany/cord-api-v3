import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, NotFoundException, ServerException } from '../../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
} from '../../../core';
import {
  CreateEducation,
  Education,
  EducationListInput,
  EducationListOutput,
  UpdateEducation,
} from './dto';

@Injectable()
export class EducationService {
  constructor(
    @Logger('education:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService
  ) {}

  // helper method for defining properties
  property = (prop: string, value: any) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    return [
      [
        node('newEducation'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, 'Property', {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newEducation'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newEducation'),
      ],
    ];
  };

  propMatch = (property: string) => {
    const perm = 'canRead' + upperFirst(property);
    return [
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(perm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('education'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ];
  };

  async list(
    { page, count, sort, order, filter }: EducationListInput,
    session: ISession
  ): Promise<EducationListOutput> {
    const result = await this.db.list<Education>({
      session,
      nodevar: 'education',
      aclReadProp: 'canReadEducationList',
      aclEditProp: 'canCreateEducation',
      props: ['degree', 'major', 'institution'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async create(
    { userId, ...input }: CreateEducation,
    session: ISession
  ): Promise<Education> {
    const id = generate();
    const createdAt = DateTime.local();
    try {
      const createEducation = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateEducation' }))
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newEducation', 'Education:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('degree', input.degree),
          ...this.property('major', input.major),
          ...this.property('institution', input.institution),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: `${input.degree} ${input.institution} admin`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: `${input.degree} ${input.institution} users`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('adminSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          ...this.permission('degree'),
          ...this.permission('major'),
          ...this.permission('institution'),
        ])
        .return('newEducation.id as id');

      try {
        await createEducation.first();
      } catch (e) {
        this.logger.error('e :>> ', e);
      }
      this.logger.debug(`Created user education`, { id, userId });

      // connect the Education to the User.
      const query = `
      MATCH (user: User {id: $userId, active: true}),
        (education:Education {id: $id, active: true})
      CREATE (user)-[:education {active: true, createdAt: datetime()}]->(education)
      RETURN  education.id as id
      `;

      await this.db
        .query()
        .raw(query, {
          userId,
          id,
        })
        .run();

      return await this.readOne(id, session);
    } catch (e) {
      this.logger.error(`Could not create education for user `, {
        id,
        userId,
      });
      throw new ServerException('Could not create education', e);
    }
  }

  async readOne(id: string, session: ISession): Promise<Education> {
    const readEducation = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadEducationList' }))
      .match([node('education', 'Education', { active: true, id })])
      .optionalMatch([...this.propMatch('degree')])
      .optionalMatch([...this.propMatch('major')])
      .optionalMatch([...this.propMatch('institution')])
      .return({
        education: [{ id: 'id', createdAt: 'createdAt' }],
        degree: [{ value: 'degree' }],
        canReadDegree: [
          {
            read: 'canReadDegree',
            edit: 'canEditDegree',
          },
        ],
        major: [{ value: 'major' }],
        canReadMajor: [{ read: 'canReadMajor', edit: 'canEditMajor' }],
        institution: [{ value: 'institution' }],
        canReadInstitution: [
          {
            read: 'canReadInstitution',
            edit: 'canEditInstitution',
          },
        ],
      });

    let result;
    try {
      result = await readEducation.first();
    } catch (e) {
      this.logger.error('e :>> ', e);
    }
    if (!result) {
      throw new NotFoundException('Could not find education', 'education.id');
    }

    return {
      id,
      createdAt: result.createdAt,
      degree: {
        value: result.degree,
        canRead: result.canReadDegree !== null ? result.canReadDegree : false,
        canEdit: result.canEditDegree !== null ? result.canEditDegree : false,
      },
      major: {
        value: result.major,
        canRead: result.canReadMajor !== null ? result.canReadMajor : false,
        canEdit: result.canEditMajor !== null ? result.canEditMajor : false,
      },
      institution: {
        value: result.institution,
        canRead:
          result.canReadInstitution !== null
            ? result.canReadInstitution
            : false,
        canEdit:
          result.canEditInstitution !== null
            ? result.canEditInstitution
            : false,
      },
    };
  }

  async update(input: UpdateEducation, session: ISession): Promise<Education> {
    const ed = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
      session,
      object: ed,
      props: ['degree', 'major', 'institution'],
      changes: input,
      nodevar: 'education',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const ed = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: ed,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async checkEducationConsistency(session: ISession): Promise<boolean> {
    const educations = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('education', 'Education', {
            active: true,
          }),
        ],
      ])
      .return('education.id as id')
      .run();

    return (
      (
        await Promise.all(
          educations.map(async (education) => {
            return await this.db.hasProperties({
              session,
              id: education.id,
              props: ['degree', 'major', 'institution'],
              nodevar: 'education',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          educations.map(async (education) => {
            return await this.db.isUniqueProperties({
              session,
              id: education.id,
              props: ['degree', 'major', 'institution'],
              nodevar: 'education',
            });
          })
        )
      ).every((n) => n)
    );
  }
}

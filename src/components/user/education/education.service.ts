import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  InternalServerErrorException as ServerException,
  UnauthorizedException as UnauthenticatedException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../../common';
import { DatabaseService, ILogger, Logger, matchSession } from '../../../core';
import {
  CreateEducation,
  Education,
  EducationListInput,
  EducationListOutput,
  UpdateEducation,
} from './dto';
import { QueryService } from '../../../core/query/query.service';
import { ForbiddenError } from 'apollo-server-core';
import { POWERS } from '../../../core/query/model/powers';

@Injectable()
export class EducationService {
  constructor(
    @Logger('education:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly db2: QueryService
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
        node('sg', 'SecurityGroup', { active: true }),
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
    let filterString = '';
    if (filter) {
      filterString = 'displayFirstName';
    }
    const result: any = await this.db2.listBaseNode(
      {
        label: 'Education',
        props: [
          {
            key: 'degree',
            value: '',
            isSingleton: true,
          },
          {
            key: 'major',
            value: '',
            isSingleton: true,
          },
          {
            key: 'institution',
            value: '',
            isSingleton: true,
          },
        ],
      },
      session.userId,
      page,
      count,
      sort,
      order,
      filterString
    );

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };

    // const result = await this.db.list<Education>({
    //   session,
    //   nodevar: 'education',
    //   aclReadProp: 'canReadEducationList',
    //   aclEditProp: 'canCreateEducation',
    //   props: ['degree', 'major', 'institution'],
    //   input: {
    //     page,
    //     count,
    //     sort,
    //     order,
    //     filter,
    //   },
    // });

    // return {
    //   items: result.items,
    //   hasMore: result.hasMore,
    //   total: result.total,
    // };
  }

  async create(
    { userId, ...input }: CreateEducation,
    session: ISession
  ): Promise<Education> {
    const seedCoId = await this.db2.getBaseNodeIdByPropertyValue(
      'OrganizationnameData',
      'Seed Company'
    );

    const id = generate();
    const createdAt = DateTime.local();

    const result = await this.db2.createBaseNode(
      {
        label: 'Education',
        id,
        createdAt: createdAt.toString(),
        props: [
          {
            key: 'degree',
            value: input.degree,
            isSingleton: false,
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'major',
            value: input.major,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: false,
          },
          {
            key: 'institution',
            value: input.institution,
            isSingleton: true,
            addToAdminSg: true,
            addToReaderSg: false,
          },
        ],
      },
      id, // the user being created is the 'requesting user'
      true,
      seedCoId
    );

    if (!result) {
      throw new ServerException('create education failed');
    }

    const connectChild = await this.db2.connectChildBaseNode(
      userId,
      'education',
      result,
      userId
    );

    if (!connectChild) {
      throw new ServerException('failed to connect education to user');
    }

    return this.readOne(result, session);

    // const id = generate();
    // const createdAt = DateTime.local();
    // try {
    //   const createEducation = this.db
    //     .query()
    //     .match(matchSession(session, { withAclEdit: 'canCreateEducation' }))
    //     .create([
    //       [
    //         node('newEducation', 'Education:BaseNode', {
    //           active: true,
    //           createdAt,
    //           id,
    //           owningOrgId: session.owningOrgId,
    //         }),
    //       ],
    //       ...this.property('degree', input.degree),
    //       ...this.property('major', input.major),
    //       ...this.property('institution', input.institution),
    //       [
    //         node('adminSG', 'SecurityGroup', {
    //           active: true,
    //           createdAt,
    //           name: `${input.degree} ${input.institution} admin`,
    //         }),
    //         relation('out', '', 'member', { active: true, createdAt }),
    //         node('requestingUser'),
    //       ],
    //       [
    //         node('readerSG', 'SecurityGroup', {
    //           active: true,
    //           createdAt,
    //           name: `${input.degree} ${input.institution} users`,
    //         }),
    //         relation('out', '', 'member', { active: true, createdAt }),
    //         node('requestingUser'),
    //       ],
    //       ...this.permission('degree'),
    //       ...this.permission('major'),
    //       ...this.permission('institution'),
    //     ])
    //     .return('newEducation.id as id');

    //   try {
    //     await createEducation.first();
    //   } catch (e) {
    //     this.logger.error('e :>> ', e);
    //   }
    //   this.logger.info(`Created user education`, { id, userId });

    //   // connect the Education to the User.
    //   const query = `
    //   MATCH (user: User {id: $userId, active: true}),
    //     (education:Education {id: $id, active: true})
    //   CREATE (user)-[:education {active: true, createdAt: datetime()}]->(education)
    //   RETURN  education.id as id
    //   `;

    //   await this.db
    //     .query()
    //     .raw(query, {
    //       userId,
    //       id,
    //     })
    //     .run();

    //   return await this.readOne(id, session);
    // } catch (e) {
    //   this.logger.error(`Could not create education for user `, {
    //     id,
    //     userId,
    //   });
    //   throw new InternalServerErrorException('Could not create education');
    // }
  }

  async readOne(id: string, session: ISession): Promise<Education> {
    const result = await this.db2.readBaseNode(
      {
        label: 'Education',
        id,
        createdAt: '',
        props: [
          {
            key: 'degree',
            value: '',
            isSingleton: true,
          },
          {
            key: 'major',
            value: '',
            isSingleton: true,
          },
          {
            key: 'institution',
            value: '',
            isSingleton: true,
          },
        ],
      },
      session.userId
    );

    if (result) {
      return result;
    } else {
      // todo get public data
      throw new ForbiddenError('Not allowed');

      throw new NotFoundException(`Could not find user`);
    }
    // const readEducation = this.db
    //   .query()
    //   .match(matchSession(session, { withAclRead: 'canReadEducationList' }))
    //   .match([node('education', 'Education', { active: true, id })])
    //   .optionalMatch([...this.propMatch('degree')])
    //   .optionalMatch([...this.propMatch('major')])
    //   .optionalMatch([...this.propMatch('institution')])
    //   .return({
    //     education: [{ id: 'id', createdAt: 'createdAt' }],
    //     degree: [{ value: 'degree' }],
    //     canReadDegree: [
    //       {
    //         read: 'canReadDegree',
    //         edit: 'canEditDegree',
    //       },
    //     ],
    //     major: [{ value: 'major' }],
    //     canReadMajor: [{ read: 'canReadMajor', edit: 'canEditMajor' }],
    //     institution: [{ value: 'institution' }],
    //     canReadInstitution: [
    //       {
    //         read: 'canReadInstitution',
    //         edit: 'canEditInstitution',
    //       },
    //     ],
    //   });

    // let result;
    // try {
    //   result = await readEducation.first();
    // } catch (e) {
    //   this.logger.error('e :>> ', e);
    // }
    // if (!result) {
    //   throw new NotFoundException('Could not find education');
    // }

    // return {
    //   id,
    //   createdAt: result.createdAt,
    //   degree: {
    //     value: result.degree,
    //     canRead: result.canReadDegree !== null ? result.canReadDegree : false,
    //     canEdit: result.canEditDegree !== null ? result.canEditDegree : false,
    //   },
    //   major: {
    //     value: result.major,
    //     canRead: result.canReadMajor !== null ? result.canReadMajor : false,
    //     canEdit: result.canEditMajor !== null ? result.canEditMajor : false,
    //   },
    //   institution: {
    //     value: result.institution,
    //     canRead:
    //       result.canReadInstitution !== null
    //         ? result.canReadInstitution
    //         : false,
    //     canEdit:
    //       result.canEditInstitution !== null
    //         ? result.canEditInstitution
    //         : false,
    //   },
    // };
  }

  async update(input: UpdateEducation, session: ISession): Promise<Education> {
    if (!session.userId) {
      throw new UnauthenticatedException();
    }
    const createdAt = DateTime.local();
    await this.db2.updateBaseNode(
      {
        label: 'Education',
        id: input.id,
        createdAt: createdAt.toString(),
        props: [
          {
            key: 'degree',
            value: input.degree,
            isSingleton: true,
          },
          {
            key: 'major',
            value: input.major,
            isSingleton: true,
          },
          {
            key: 'institution',
            value: input.institution,
            isSingleton: true,
          },
        ],
      },
      session.userId
    );

    const updated = await this.readOne(input.id, session);
    return updated;
    // const ed = await this.readOne(input.id, session);

    // return this.db.sgUpdateProperties({
    //   session,
    //   object: ed,
    //   props: ['degree', 'major', 'institution'],
    //   changes: input,
    //   nodevar: 'education',
    // });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const education = await this.readOne(id, session);
    try {
      if (session.userId) {
        await this.db2.deleteBaseNode(
          id,
          session.userId,
          'Education',
          POWERS.DELETE_EDUCATION
        );
      } else {
        this.logger.error('no user id provided');
      }
    } catch (e) {
      this.logger.error('Could not delete user', { exception: e });
      throw new ServerException('Could not delete user');
    }

    // const ed = await this.readOne(id, session);
    // try {
    //   await this.db.deleteNode({
    //     session,
    //     object: ed,
    //     aclEditProp: 'canDeleteOwnUser',
    //   });
    // } catch (e) {
    //   this.logger.error('Failed to delete', { id, exception: e });
    //   throw new ServerException('Failed to delete');
    // }
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
            return this.db.hasProperties({
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
            return this.db.isUniqueProperties({
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

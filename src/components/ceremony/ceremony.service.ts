import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import {
  generateId,
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { Role, rolesForScope } from '../authorization';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  Ceremony,
  CeremonyListInput,
  CeremonyListOutput,
  CreateCeremony,
  UpdateCeremony,
} from './dto';

@Injectable()
export class CeremonyService {
  private readonly securedProperties = {
    type: true,
    planned: true,
    estimatedDate: true,
    actualDate: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    @Logger('ceremony:service') private readonly logger: ILogger
  ) {}

  async create(input: CreateCeremony, session: Session): Promise<Ceremony> {
    const secureProps: Property[] = [
      {
        key: 'type',
        value: input.type,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'planned',
        value: input.planned,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'estimatedDate',
        value: input.estimatedDate,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'actualDate',
        value: input.actualDate,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const query = this.db
        .query()
        .call(matchRequestingUser, session)
        .call(createBaseNode, await generateId(), 'Ceremony', secureProps)
        .return('node.id as id');

      const result = await query.first();

      if (!result) {
        throw new ServerException('failed to create a ceremony');
      }
      // commenting out, not sure if this is the right spot to call auth.
      // needs to be called after all relationships are made with engagement.

      // const dbCeremony = new DbCeremony();
      // await this.authorizationService.processNewBaseNode(
      //   dbCeremony,
      //   result.id,
      //   session.userId
      // );

      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.warning('Failed to create ceremony', {
        exception,
      });

      throw exception;
    }
  }

  async readOne(id: ID, session: Session): Promise<Ceremony> {
    this.logger.debug(`Query readOne Ceremony`, { id, userId: session.userId });
    if (!id) {
      throw new InputException('No ceremony id to search for', 'ceremony.id');
    }
    const readCeremony = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Ceremony', { id })])
      .call(matchPropList)
      .optionalMatch([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'Engagement'),
        relation('out', '', { active: true }),
        node('node', 'Ceremony', { id }),
      ])
      .with(['node', 'propList', 'project'])
      .call(matchMemberRoles, session.userId)
      .return(['node', 'propList', 'memberRoles'])
      .asResult<
        StandardReadResult<DbPropsOfDto<Ceremony>> & {
          memberRoles: Role[];
        }
      >();

    const result = await readCeremony.first();
    if (!result) {
      throw new NotFoundException('Could not find ceremony', 'ceremony.id');
    }

    const parsedProps = parsePropList(result.propList);

    const securedProps = await this.authorizationService.secureProperties(
      Ceremony,
      parsedProps,
      session,
      result.memberRoles.flat().map(rolesForScope('project'))
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      type: parsedProps.type,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateCeremony, session: Session): Promise<Ceremony> {
    const object = await this.readOne(input.id, session);
    const realChanges = await this.db.getActualChanges(
      object,
      input,
      Ceremony.Props
    );
    await this.authorizationService.verifyCanEditChanges(
      Ceremony,
      object,
      realChanges
    );

    return await this.db.updateProperties({
      type: 'Ceremony',
      object: object,
      changes: realChanges,
    });
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find ceremony', 'ceremony.id');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Ceremony'
      );

    try {
      await this.db.deleteNodeNew({
        object,
      });
    } catch (exception) {
      this.logger.warning('Failed to delete Ceremony', {
        exception,
      });
      throw new ServerException('Failed to delete Ceremony');
    }
  }

  async list(
    { filter, ...input }: CeremonyListInput,
    session: Session
  ): Promise<CeremonyListOutput> {
    const label = 'Ceremony';
    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.type
          ? [
              relation('out', '', 'type', { active: true }),
              node('name', 'Property', { value: filter.type }),
            ]
          : []),
      ])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async checkCeremonyConsistency(session: Session): Promise<boolean> {
    const ceremonies = await this.db
      .query()
      .match([matchSession(session), [node('ceremony', 'Ceremony')]])
      .return('ceremony.id as id')
      .run();

    return (
      await Promise.all(
        ceremonies.map(async (ceremony) => {
          return await this.db.hasProperties({
            session,
            id: ceremony.id,
            props: ['type'],
            nodevar: 'ceremony',
          });
        })
      )
    ).every((n) => n);
  }
}

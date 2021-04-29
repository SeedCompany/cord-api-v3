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
  matchPropsAndProjectSensAndScopedRoles,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, runListQuery } from '../../core/database/results';
import { ScopedRole } from '../authorization';
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
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    @Logger('ceremony:service') private readonly logger: ILogger
  ) {}

  async create(input: CreateCeremony, session: Session): Promise<ID> {
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
        .apply(matchRequestingUser(session))
        .apply(createBaseNode(await generateId(), 'Ceremony', secureProps))
        .logIt()
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

      return result.id;
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
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'Engagement'),
        relation('out', '', { active: true }),
        node('node', 'Ceremony', { id }),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return(['props', 'scopedRoles'])
      .asResult<{
        props: DbPropsOfDto<Ceremony, true>;
        scopedRoles: ScopedRole[];
      }>();

    const result = await readCeremony.first();
    if (!result) {
      throw new NotFoundException('Could not find ceremony', 'ceremony.id');
    }

    const securedProps = await this.authorizationService.secureProperties({
      resource: Ceremony,
      props: result.props,
      sessionOrUserId: session,
      otherRoles: result.scopedRoles,
    });

    return {
      ...result.props,
      ...securedProps,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateCeremony, session: Session): Promise<Ceremony> {
    const object = await this.readOne(input.id, session);
    const changes = this.db.getActualChanges(Ceremony, object, input);
    await this.authorizationService.verifyCanEditChanges(
      Ceremony,
      object,
      changes
    );
    return await this.db.updateProperties({
      type: Ceremony,
      object,
      changes,
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
      await this.db.deleteNode(object);
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
      .apply(calculateTotalAndPaginateList(Ceremony, input));

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

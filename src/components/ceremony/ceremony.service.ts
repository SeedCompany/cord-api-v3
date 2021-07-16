import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { HandleIdLookup, ILogger, Logger, Property } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { CeremonyRepository } from './ceremony.repository';
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
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly ceremonyRepo: CeremonyRepository,
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
      const query = await this.ceremonyRepo.create(session, secureProps);

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

  @HandleIdLookup(Ceremony)
  async readOne(id: ID, session: Session): Promise<Ceremony> {
    this.logger.debug(`Query readOne Ceremony`, { id, userId: session.userId });
    if (!id) {
      throw new InputException('No ceremony id to search for', 'ceremony.id');
    }

    const result = await this.ceremonyRepo.readOne(id, session);

    if (!result) {
      throw new NotFoundException('Could not find ceremony', 'ceremony.id');
    }

    const securedProps = await this.authorizationService.secureProperties(
      Ceremony,
      result.props,
      session,
      result.scopedRoles
    );

    return {
      ...result.props,
      ...securedProps,
      canDelete: await this.ceremonyRepo.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateCeremony, session: Session): Promise<Ceremony> {
    const object = await this.readOne(input.id, session);
    const changes = this.ceremonyRepo.getActualChanges(object, input);
    await this.authorizationService.verifyCanEditChanges(
      Ceremony,
      object,
      changes
    );
    return await this.ceremonyRepo.updateProperties(object, changes);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find ceremony', 'ceremony.id');
    }

    const canDelete = await this.ceremonyRepo.checkDeletePermission(
      id,
      session
    );

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Ceremony'
      );

    try {
      await this.ceremonyRepo.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete Ceremony', {
        exception,
      });
      throw new ServerException('Failed to delete Ceremony');
    }
  }

  async list(
    input: CeremonyListInput,
    session: Session
  ): Promise<CeremonyListOutput> {
    const results = await this.ceremonyRepo.list(input, session);
    return await mapListResults(results, (id) => this.readOne(id, session));
  }
}

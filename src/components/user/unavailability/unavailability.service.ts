import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../../common';
import { HandleIdLookup, ILogger, Logger } from '../../../core';
import { AuthorizationService } from '../../authorization/authorization.service';
import {
  CreateUnavailability,
  Unavailability,
  UnavailabilityListInput,
  UnavailabilityListOutput,
  UpdateUnavailability,
} from './dto';
import { UnavailabilityRepository } from './unavailability.repository';

@Injectable()
export class UnavailabilityService {
  constructor(
    @Logger('unavailability:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: UnavailabilityRepository
  ) {}

  async create(
    { userId, ...input }: CreateUnavailability,
    session: Session
  ): Promise<Unavailability> {
    try {
      const createUnavailabilityResult = await this.repo.create(session, {
        userId,
        ...input,
      });

      if (!createUnavailabilityResult) {
        this.logger.error(`Could not create unavailability`, {
          userId,
        });
        throw new ServerException('Could not create unavailability');
      }

      this.logger.debug(`Created user unavailability`, {
        id: createUnavailabilityResult.id,
        userId,
      });

      // connect the Unavailability to the User.

      await this.repo.connectUnavailability(
        createUnavailabilityResult.id,
        userId
      );
      await this.authorizationService.processNewBaseNode(
        Unavailability,
        createUnavailabilityResult.id,
        userId
      );

      return await this.readOne(createUnavailabilityResult.id, session);
    } catch {
      this.logger.error(`Could not create unavailability`, {
        userId,
      });
      throw new ServerException('Could not create unavailability');
    }
  }

  @HandleIdLookup(Unavailability)
  async readOne(id: ID, session: Session): Promise<Unavailability> {
    const result = await this.repo.readOne(id, session);
    return await this.secure(result, session);
  }

  private async secure(
    dto: UnsecuredDto<Unavailability>,
    session: Session
  ): Promise<Unavailability> {
    const securedProps = await this.authorizationService.secureProperties(
      Unavailability,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(dto.id, session), // TODO
    };
  }

  async update(
    input: UpdateUnavailability,
    session: Session
  ): Promise<Unavailability> {
    const unavailability = await this.readOne(input.id, session);

    const result = await this.repo.getUserIdByUnavailability(session, input);
    if (!result) {
      throw new NotFoundException(
        'Could not find user associated with unavailability',
        'user.unavailability'
      );
    }

    const changes = this.repo.getActualChanges(unavailability, input);

    if (result.id !== session.userId) {
      await this.authorizationService.verifyCanEditChanges(
        Unavailability,
        unavailability,
        changes
      );
    }
    return await this.repo.updateProperties(unavailability, changes);
  }

  async delete(id: ID, session: Session): Promise<void> {
    this.logger.debug(`mutation delete unavailability`);
    const ua = await this.readOne(id, session);
    if (!ua) {
      throw new NotFoundException(
        'Unavailability not found',
        'unavailability.id'
      );
    }
    await this.repo.deleteNode(ua);
  }

  async list(
    { page, count, sort, order, filter }: UnavailabilityListInput,
    session: Session
  ): Promise<UnavailabilityListOutput> {
    const result = await this.repo.list(
      { page, count, sort, order, filter },
      session
    );

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}

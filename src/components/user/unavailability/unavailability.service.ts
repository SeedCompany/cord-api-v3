import { Injectable } from '@nestjs/common';
import {
  ID,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../../common';
import { HandleIdLookup, ILogger, Logger } from '../../../core';
import { mapListResults } from '../../../core/database/results';
import { Privileges } from '../../authorization';
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
    private readonly privileges: Privileges,
    private readonly repo: UnavailabilityRepository,
  ) {}

  async create(
    input: CreateUnavailability,
    session: Session,
  ): Promise<Unavailability> {
    try {
      this.privileges.for(session, Unavailability).verifyCan('create');

      // create and connect the Unavailability to the User.
      const id = await this.repo.create(input, session);

      this.logger.debug(`Created user unavailability`, {
        id,
        userId: input.userId,
      });

      return await this.readOne(id, session);
    } catch {
      this.logger.error(`Could not create unavailability`, {
        userId: input.userId,
      });
      throw new ServerException('Could not create unavailability');
    }
  }

  @HandleIdLookup(Unavailability)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<Unavailability> {
    const result = await this.repo.readOne(id);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const unavailabilities = await this.repo.readMany(ids);
    return await Promise.all(
      unavailabilities.map((dto) => this.secure(dto, session)),
    );
  }

  private async secure(
    dto: UnsecuredDto<Unavailability>,
    session: Session,
  ): Promise<Unavailability> {
    const securedProps = this.privileges
      .for(session, Unavailability)
      .secure(dto);

    return {
      ...dto,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(dto.id, session), // TODO
    };
  }

  async update(
    input: UpdateUnavailability,
    session: Session,
  ): Promise<Unavailability> {
    const unavailability = await this.readOne(input.id, session);

    const result = await this.repo.getUserIdByUnavailability(input.id);
    if (!result) {
      throw new NotFoundException(
        'Could not find user associated with unavailability',
        'user.unavailability',
      );
    }

    const changes = this.repo.getActualChanges(unavailability, input);

    if (result.id !== session.userId) {
      this.privileges.for(session, Unavailability).verifyChanges(changes);
    }
    return await this.repo.updateProperties(unavailability, changes);
  }

  async delete(id: ID, session: Session): Promise<void> {
    this.logger.debug(`mutation delete unavailability`);
    const ua = await this.readOne(id, session);
    if (!ua) {
      throw new NotFoundException(
        'Unavailability not found',
        'unavailability.id',
      );
    }
    await this.repo.deleteNode(ua);
  }

  async list(
    input: UnavailabilityListInput,
    session: Session,
  ): Promise<UnavailabilityListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}

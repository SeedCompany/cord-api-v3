import { Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { Privileges } from '../authorization';
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
    private readonly privileges: Privileges,
    private readonly ceremonyRepo: CeremonyRepository,
    @Logger('ceremony:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreateCeremony): Promise<ID> {
    try {
      const result = await this.ceremonyRepo.create(input);

      if (!result) {
        throw new ServerException('failed to create a ceremony');
      }

      return result.id;
    } catch (exception) {
      this.logger.warning('Failed to create ceremony', {
        exception,
      });

      throw exception;
    }
  }

  @HandleIdLookup(Ceremony)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<Ceremony> {
    this.logger.debug(`Query readOne Ceremony`, { id, userId: session.userId });
    if (!id) {
      throw new InputException('No ceremony id to search for', 'ceremony.id');
    }

    const dto = await this.ceremonyRepo.readOne(id, session);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const ceremonies = await this.ceremonyRepo.readMany(ids, session);
    return await Promise.all(
      ceremonies.map((dto) => this.secure(dto, session)),
    );
  }

  async secure(dto: UnsecuredDto<Ceremony>, session: Session) {
    return this.privileges.for(session, Ceremony).secure(dto);
  }

  async update(input: UpdateCeremony, session: Session): Promise<Ceremony> {
    const object = await this.readOne(input.id, session);
    const changes = this.ceremonyRepo.getActualChanges(object, input);
    this.privileges.for(session, Ceremony, object).verifyChanges(changes);
    return await this.ceremonyRepo.update(object, changes);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    // Only called internally, not exposed directly to users
    // this.privileges.for(session, Ceremony, object).verifyCan('delete');

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
    session: Session,
  ): Promise<CeremonyListOutput> {
    const results = await this.ceremonyRepo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}

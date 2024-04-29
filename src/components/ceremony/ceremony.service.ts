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
    private readonly repo: CeremonyRepository,
    @Logger('ceremony:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreateCeremony): Promise<ID> {
    try {
      const { id } = await this.repo.create(input);

      return id;
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

    const dto = await this.repo.readOne(id, session);
    return this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const ceremonies = await this.repo.readMany(ids, session);
    return ceremonies.map((dto) => this.secure(dto, session));
  }

  secure(dto: UnsecuredDto<Ceremony>, session: Session) {
    return this.privileges.for(session, Ceremony).secure(dto);
  }

  async update(input: UpdateCeremony, session: Session): Promise<Ceremony> {
    const object = await this.repo.readOne(input.id, session);
    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(session, Ceremony, object).verifyChanges(changes);
    const updated = await this.repo.update(
      {
        id: input.id,
        ...changes,
      },
      session,
    );
    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.repo.readOne(id, session);

    // Only called internally, not exposed directly to users
    // this.privileges.for(session, Ceremony, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
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
    const results = await this.repo.list(input, session);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }
}

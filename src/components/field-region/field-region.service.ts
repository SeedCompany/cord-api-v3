import { Injectable } from '@nestjs/common';
import {
  ID,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ILogger, Logger } from '~/core';
import { Privileges } from '../authorization';
import {
  CreateFieldRegion,
  FieldRegion,
  FieldRegionListInput,
  FieldRegionListOutput,
  UpdateFieldRegion,
} from './dto';
import { FieldRegionRepository } from './field-region.repository';

@Injectable()
export class FieldRegionService {
  constructor(
    @Logger('field-region:service') private readonly logger: ILogger,
    private readonly privileges: Privileges,
    private readonly repo: FieldRegionRepository,
  ) {}

  async create(
    input: CreateFieldRegion,
    session: Session,
  ): Promise<FieldRegion> {
    this.privileges.for(session, FieldRegion).verifyCan('create');
    const dto = await this.repo.create(input, session);
    return this.secure(dto, session);
  }

  @HandleIdLookup(FieldRegion)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<FieldRegion> {
    this.logger.debug(`Read Field Region`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const fieldRegions = await this.repo.readMany(ids);
    return fieldRegions.map((dto) => this.secure(dto, session));
  }

  private secure(dto: UnsecuredDto<FieldRegion>, session: Session) {
    return this.privileges.for(session, FieldRegion).secure(dto);
  }

  async update(
    input: UpdateFieldRegion,
    session: Session,
  ): Promise<FieldRegion> {
    const fieldRegion = await this.repo.readOne(input.id);

    const changes = this.repo.getActualChanges(fieldRegion, input);
    this.privileges
      .for(session, FieldRegion, fieldRegion)
      .verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(session, FieldRegion, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FieldRegionListInput,
    session: Session,
  ): Promise<FieldRegionListOutput> {
    const results = await this.repo.list(input, session);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }
}

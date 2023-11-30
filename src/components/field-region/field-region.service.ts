import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  ObjectView,
  SecuredList,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
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
    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'fieldRegion.name',
        'FieldRegion with this name already exists.',
      );
    }

    const result = await this.repo.create(input, session);

    if (!result) {
      throw new ServerException('failed to create field region');
    }

    this.logger.debug(`field region created`, { id: result.id });
    return await this.readOne(result.id, session);
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
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const fieldRegions = await this.repo.readMany(ids);
    return await Promise.all(
      fieldRegions.map((dto) => this.secure(dto, session)),
    );
  }

  private async secure(
    dto: UnsecuredDto<FieldRegion>,
    session: Session,
  ): Promise<FieldRegion> {
    return this.privileges.for(session, FieldRegion).secure(dto);
  }

  async update(
    input: UpdateFieldRegion,
    session: Session,
  ): Promise<FieldRegion> {
    const fieldRegion = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(fieldRegion, input);
    this.privileges
      .for(session, FieldRegion, fieldRegion)
      .verifyChanges(changes);

    await this.repo.update(fieldRegion, changes);

    return await this.readOne(input.id, session);
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
    if (this.privileges.for(session, FieldRegion).can('read')) {
      const results = await this.repo.list(input, session);
      return await mapListResults(results, (dto) => this.secure(dto, session));
    } else {
      return SecuredList.Redacted;
    }
  }
}

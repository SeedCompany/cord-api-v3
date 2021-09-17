import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
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
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: FieldRegionRepository
  ) {}

  async create(
    input: CreateFieldRegion,
    session: Session
  ): Promise<FieldRegion> {
    const checkName = await this.repo.checkName(input.name);

    if (checkName) {
      throw new DuplicateException(
        'fieldRegion.name',
        'FieldRegion with this name already exists.'
      );
    }

    const result = await this.repo.create(input, session);

    if (!result) {
      throw new ServerException('failed to create field region');
    }

    await this.authorizationService.processNewBaseNode(
      FieldRegion,
      result.id,
      session.userId
    );

    this.logger.debug(`field region created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  @HandleIdLookup(FieldRegion)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<FieldRegion> {
    this.logger.debug(`Read Field Region`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id, session);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const fieldRegions = await this.repo.readMany(ids, session);
    return await Promise.all(
      fieldRegions.map((dto) => this.secure(dto, session))
    );
  }

  private async secure(
    dto: UnsecuredDto<FieldRegion>,
    session: Session
  ): Promise<FieldRegion> {
    const securedProps = await this.authorizationService.secureProperties(
      FieldRegion,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(
    input: UpdateFieldRegion,
    session: Session
  ): Promise<FieldRegion> {
    const fieldRegion = await this.readOne(input.id, session);
    const changes = this.repo.getActualChanges(fieldRegion, input);
    await this.authorizationService.verifyCanEditChanges(
      FieldRegion,
      fieldRegion,
      changes
    );
    // update director

    await this.repo.updateProperties(fieldRegion, changes);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Field Region');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Field Region'
      );

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FieldRegionListInput,
    session: Session
  ): Promise<FieldRegionListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}

import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ObjectView,
  SecuredList,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import {
  CreateFieldZone,
  FieldZone,
  FieldZoneListInput,
  FieldZoneListOutput,
  UpdateFieldZone,
} from './dto';
import { FieldZoneRepository } from './field-zone.repository';

@Injectable()
export class FieldZoneService {
  constructor(
    @Logger('field-zone:service') private readonly logger: ILogger,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: FieldZoneRepository
  ) {}

  async create(input: CreateFieldZone, session: Session): Promise<FieldZone> {
    const checkName = await this.repo.checkName(input.name);

    if (checkName) {
      throw new DuplicateException(
        'fieldZone.name',
        'FieldZone with this name already exists.'
      );
    }
    const result = await this.repo.create(input, session);

    if (!result) {
      throw new ServerException('failed to create field zone');
    }

    await this.authorizationService.processNewBaseNode(
      FieldZone,
      result.id,
      session.userId
    );

    this.logger.debug(`field zone created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  @HandleIdLookup(FieldZone)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<FieldZone> {
    this.logger.debug(`Read Field Zone`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const fieldZones = await this.repo.readMany(ids);
    return await Promise.all(
      fieldZones.map((dto) => this.secure(dto, session))
    );
  }

  private async secure(
    dto: UnsecuredDto<FieldZone>,
    session: Session
  ): Promise<FieldZone> {
    const securedProps = await this.authorizationService.secureProperties(
      FieldZone,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(input: UpdateFieldZone, session: Session): Promise<FieldZone> {
    const fieldZone = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(fieldZone, input);
    await this.authorizationService.verifyCanEditChanges(
      FieldZone,
      fieldZone,
      changes
    );

    const { directorId, ...simpleChanges } = changes;

    // update director
    if (directorId) {
      await this.repo.updateDirector(directorId, input.id);
    }

    await this.repo.updateProperties(fieldZone, simpleChanges);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Field Zone');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Field Zone'
      );

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: FieldZoneListInput,
    session: Session
  ): Promise<FieldZoneListOutput> {
    if (await this.authorizationService.canList(FieldZone, session)) {
      const results = await this.repo.list(input, session);
      return await mapListResults(results, (dto) => this.secure(dto, session));
    } else {
      return SecuredList.Redacted;
    }
  }
}

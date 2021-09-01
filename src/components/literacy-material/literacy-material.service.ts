import { Injectable } from '@nestjs/common';
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
import { HandleIdLookup, ILogger, Logger, OnIndex } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
import {
  CreateLiteracyMaterial,
  LiteracyMaterial,
  LiteracyMaterialListInput,
  LiteracyMaterialListOutput,
  UpdateLiteracyMaterial,
} from './dto';
import { LiteracyMaterialRepository } from './literacy-material.repository';

@Injectable()
export class LiteracyMaterialService {
  constructor(
    @Logger('literacyMaterial:service') private readonly logger: ILogger,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: LiteracyMaterialRepository
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:LiteracyName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LiteracyName) ASSERT n.value IS UNIQUE',
    ];
  }

  async create(
    input: CreateLiteracyMaterial,
    session: Session
  ): Promise<LiteracyMaterial> {
    const checkLiteracy = await this.repo.checkLiteracy(input.name);

    if (checkLiteracy) {
      throw new DuplicateException(
        'literacyMaterial.name',
        'Literacy with this name already exists'
      );
    }

    try {
      const result = await this.repo.create(input, session);

      if (!result) {
        throw new ServerException('failed to create a literacy material');
      }

      await this.authorizationService.processNewBaseNode(
        LiteracyMaterial,
        result.id,
        session.userId
      );

      await this.scriptureRefService.create(
        result.id,
        input.scriptureReferences,
        session
      );

      this.logger.debug(`literacy material created`, { id: result.id });
      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.error(`Could not create literacy material`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException(
        'Could not create literacy material',
        exception
      );
    }
  }

  @HandleIdLookup(LiteracyMaterial)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<LiteracyMaterial> {
    this.logger.debug(`Read literacyMaterial`, {
      id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id, session);
    return await this.secure(result, session);
  }

  private async secure(
    dto: UnsecuredDto<LiteracyMaterial>,
    session: Session
  ): Promise<LiteracyMaterial> {
    const securedProps = await this.authorizationService.secureProperties(
      LiteracyMaterial,
      dto,
      session
    );

    const scriptureReferences = await this.scriptureRefService.list(
      dto.id,
      session
    );

    return {
      ...dto,
      ...securedProps,
      scriptureReferences: {
        ...securedProps.scriptureReferences,
        value: scriptureReferences,
      },
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(
    input: UpdateLiteracyMaterial,
    session: Session
  ): Promise<LiteracyMaterial> {
    const literacyMaterial = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(literacyMaterial, input);
    await this.authorizationService.verifyCanEditChanges(
      LiteracyMaterial,
      literacyMaterial,
      changes
    );
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);

    await this.repo.updateProperties(literacyMaterial, simpleChanges);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const literacyMaterial = await this.readOne(id, session);

    if (!literacyMaterial) {
      throw new NotFoundException('Could not find Literacy Material');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Literacy Material'
      );

    try {
      await this.repo.deleteNode(literacyMaterial);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted literacyMaterial with id`, { id });
  }

  async list(
    input: LiteracyMaterialListInput,
    session: Session
  ): Promise<LiteracyMaterialListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (id) => this.readOne(id, session));
  }
}

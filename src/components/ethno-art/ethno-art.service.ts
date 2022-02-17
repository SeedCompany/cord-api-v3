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
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { ifDiff } from '../../core/database/changes';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { LiteracyMaterial } from '../literacy-material/dto';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
import { isScriptureEqual } from '../scripture/books';
import { Song } from '../song/dto';
import {
  CreateEthnoArt,
  EthnoArt,
  EthnoArtListInput,
  UpdateEthnoArt,
} from './dto';
import { EthnoArtRepository } from './ethno-art.repository';

@Injectable()
export class EthnoArtService {
  constructor(
    @Logger('ethno-art:service') private readonly logger: ILogger,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService,
    private readonly repo: EthnoArtRepository
  ) {}

  async create(input: CreateEthnoArt, session: Session): Promise<EthnoArt> {
    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'ethnoArt.name',
        'Ethno art with this name already exists'
      );
    }

    try {
      const result = await this.repo.create(input, session);

      if (!result) {
        throw new ServerException('Failed to create ethno art');
      }

      await this.scriptureRefService.create(
        result.id,
        input.scriptureReferences,
        session
      );

      this.logger.debug(`ethno art created`, { id: result.id });
      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.error('Could not create ethno art', {
        exception,
      });
      throw new ServerException('Could not create ethno art', exception);
    }
  }

  @HandleIdLookup([EthnoArt, Song, LiteracyMaterial])
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<EthnoArt> {
    const result = await this.repo.readOne(id);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const ethnoArt = await this.repo.readMany(ids);
    return await Promise.all(ethnoArt.map((dto) => this.secure(dto, session)));
  }

  private async secure(
    dto: UnsecuredDto<EthnoArt>,
    session: Session
  ): Promise<EthnoArt> {
    const securedProps = await this.authorizationService.secureProperties(
      EthnoArt,
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

  async update(input: UpdateEthnoArt, session: Session): Promise<EthnoArt> {
    const ethnoArt = await this.readOne(input.id, session);

    const changes = {
      ...this.repo.getActualChanges(ethnoArt, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        ethnoArt.scriptureReferences.value
      ),
    };

    await this.authorizationService.verifyCanEditChanges(
      EthnoArt,
      ethnoArt,
      changes
    );

    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);

    await this.repo.updateProperties(ethnoArt, simpleChanges);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const ethnoArt = await this.readOne(id, session);

    if (!ethnoArt) {
      throw new NotFoundException('Could not find Ethno Art');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);
    if (!canDelete) {
      throw new UnauthorizedException(
        'You do not have permissions to delete this Ethno Art'
      );
    }

    try {
      await this.repo.deleteNode(ethnoArt);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted ethnoArt with id`, { id });
  }

  async list(input: EthnoArtListInput, session: Session) {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}

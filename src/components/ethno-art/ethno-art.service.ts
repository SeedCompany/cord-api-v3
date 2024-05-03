import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  ObjectView,
  ServerException,
  Session,
} from '../../common';
import { DbTypeOf, HandleIdLookup, ILogger, Logger } from '../../core';
import { ifDiff } from '../../core/database/changes';
import { mapListResults } from '../../core/database/results';
import { Privileges } from '../authorization';
import { isScriptureEqual, ScriptureReferenceService } from '../scripture';
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
    private readonly scriptureRefs: ScriptureReferenceService,
    private readonly privileges: Privileges,
    private readonly repo: EthnoArtRepository,
  ) {}

  async create(input: CreateEthnoArt, session: Session): Promise<EthnoArt> {
    this.privileges.for(session, EthnoArt).verifyCan('create');
    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'ethnoArt.name',
        'Ethno art with this name already exists',
      );
    }

    try {
      const result = await this.repo.create(input);

      if (!result) {
        throw new ServerException('Failed to create ethno art');
      }

      await this.scriptureRefs.create(
        result.id,
        input.scriptureReferences,
        session,
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

  @HandleIdLookup(EthnoArt)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<EthnoArt> {
    const result = await this.repo.readOne(id);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const ethnoArt = await this.repo.readMany(ids);
    return await Promise.all(ethnoArt.map((dto) => this.secure(dto, session)));
  }

  private async secure(
    dto: DbTypeOf<EthnoArt>,
    session: Session,
  ): Promise<EthnoArt> {
    return this.privileges.for(session, EthnoArt).secure({
      ...dto,
      scriptureReferences: this.scriptureRefs.parseList(
        dto.scriptureReferences,
      ),
    });
  }

  async update(input: UpdateEthnoArt, session: Session): Promise<EthnoArt> {
    const ethnoArt = await this.readOne(input.id, session);

    const changes = {
      ...this.repo.getActualChanges(ethnoArt, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        ethnoArt.scriptureReferences.value,
      ),
    };

    this.privileges.for(session, EthnoArt, ethnoArt).verifyChanges(changes);

    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefs.update(input.id, scriptureReferences);

    await this.repo.update(ethnoArt, simpleChanges);

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const ethnoArt = await this.readOne(id, session);

    this.privileges.for(session, EthnoArt, ethnoArt).verifyCan('delete');

    try {
      await this.repo.deleteNode(ethnoArt);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted ethnoArt with id`, { id });
  }

  async list(input: EthnoArtListInput, session: Session) {
    // -- don't need a check for canList. all roles are allowed to see at least one prop,
    //    and this isn't a sensitive component.
    const results = await this.repo.list(input);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}

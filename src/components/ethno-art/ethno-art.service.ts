import { Injectable } from '@nestjs/common';
import {
  ID,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { ifDiff } from '~/core/database/changes';
import { Privileges } from '../authorization';
import { isScriptureEqual } from '../scripture';
import {
  CreateEthnoArt,
  EthnoArt,
  EthnoArtListInput,
  EthnoArtListOutput,
  UpdateEthnoArt,
} from './dto';
import { EthnoArtRepository } from './ethno-art.repository';

@Injectable()
export class EthnoArtService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: EthnoArtRepository,
  ) {}

  async create(input: CreateEthnoArt, session: Session): Promise<EthnoArt> {
    const dto = await this.repo.create(input, session);
    this.privileges.for(session, EthnoArt, dto).verifyCan('create');
    return this.secure(dto, session);
  }

  @HandleIdLookup(EthnoArt)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<EthnoArt> {
    const result = await this.repo.readOne(id);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const ethnoArt = await this.repo.readMany(ids);
    return ethnoArt.map((dto) => this.secure(dto, session));
  }

  private secure(dto: UnsecuredDto<EthnoArt>, session: Session): EthnoArt {
    return this.privileges.for(session, EthnoArt).secure(dto);
  }

  async update(input: UpdateEthnoArt, session: Session): Promise<EthnoArt> {
    const ethnoArt = await this.repo.readOne(input.id);
    const changes = {
      ...this.repo.getActualChanges(ethnoArt, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        ethnoArt.scriptureReferences,
      ),
    };
    this.privileges.for(session, EthnoArt, ethnoArt).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const ethnoArt = await this.repo.readOne(id);

    this.privileges.for(session, EthnoArt, ethnoArt).verifyCan('delete');

    try {
      await this.repo.deleteNode(ethnoArt);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: EthnoArtListInput,
    session: Session,
  ): Promise<EthnoArtListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }
}

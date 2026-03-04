import { Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { ifDiff } from '~/core/database/changes';
import { HandleIdLookup } from '~/core/resources';
import { Privileges } from '../authorization';
import { isScriptureEqual } from '../scripture';
import {
  type CreateEthnoArt,
  EthnoArt,
  type EthnoArtListInput,
  type EthnoArtListOutput,
  type UpdateEthnoArt,
} from './dto';
import { EthnoArtRepository } from './ethno-art.repository';

@Injectable()
export class EthnoArtService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: EthnoArtRepository,
  ) {}

  async create(input: CreateEthnoArt): Promise<EthnoArt> {
    const dto = await this.repo.create(input);
    this.privileges.for(EthnoArt, dto).verifyCan('create');
    return this.secure(dto);
  }

  @HandleIdLookup(EthnoArt)
  async readOne(
    id: ID,

    _view?: ObjectView,
  ): Promise<EthnoArt> {
    const result = await this.repo.readOne(id);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const ethnoArt = await this.repo.readMany(ids);
    return ethnoArt.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<EthnoArt>): EthnoArt {
    return this.privileges.for(EthnoArt).secure(dto);
  }

  async update(input: UpdateEthnoArt): Promise<EthnoArt> {
    const ethnoArt = await this.repo.readOne(input.id);
    const changes = {
      ...this.repo.getActualChanges(ethnoArt, input),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        ethnoArt.scriptureReferences,
      ),
    };
    this.privileges.for(EthnoArt, ethnoArt).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const ethnoArt = await this.repo.readOne(id);

    this.privileges.for(EthnoArt, ethnoArt).verifyCan('delete');

    try {
      await this.repo.deleteNode(ethnoArt);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: EthnoArtListInput): Promise<EthnoArtListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }
}

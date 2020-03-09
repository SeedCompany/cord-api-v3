import { Injectable, NotImplementedException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import { ILogger, Logger, PropertyUpdaterService } from '../../core';
import { ISession } from '../auth';
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
    private readonly db: Connection,
    private readonly propertyUpdater: PropertyUpdaterService,
    @Logger('ceremony:service') private readonly logger: ILogger
  ) {}

  async readOne(_langId: string, _session: ISession): Promise<Ceremony> {
    throw new NotImplementedException();
  }

  async list(
    _input: CeremonyListInput,
    _session: ISession
  ): Promise<CeremonyListOutput> {
    throw new NotImplementedException();
  }

  async create(input: CreateCeremony, _session: ISession): Promise<Ceremony> {
    this.logger.info('Creating ceremony', input);
    throw new NotImplementedException();
  }

  async update(_input: UpdateCeremony, _session: ISession): Promise<Ceremony> {
    throw new NotImplementedException();
  }

  async delete(_id: string, _session: ISession): Promise<void> {
    throw new NotImplementedException();
  }
}

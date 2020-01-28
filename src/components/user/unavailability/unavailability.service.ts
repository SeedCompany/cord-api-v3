import { Injectable } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import {
  CreateUnavailability,
  SecuredUnavailabilityList,
  Unavailability,
  UnavailabilityListInput,
  UpdateUnavailability,
} from './dto';

@Injectable()
export class UnavailabilityService {
  constructor(private readonly db: Connection) {}

  async list(
    userId: string,
    input: UnavailabilityListInput,
    token: string,
  ): Promise<SecuredUnavailabilityList> {
    throw new Error('Not implemented');
  }

  async create(
    input: CreateUnavailability,
    token: string,
  ): Promise<Unavailability> {
    throw new Error('Not implemented');
  }

  async update(
    input: UpdateUnavailability,
    token: string,
  ): Promise<Unavailability> {
    throw new Error('Not implemented');
  }

  async delete(id: string, token: string): Promise<void> {
    throw new Error('Not implemented');
  }
}

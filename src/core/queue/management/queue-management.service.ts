import { getQueueToken } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { NotFoundException, UnauthorizedException } from '~/common';
import { Identity } from '../../authentication';
import { type Queue } from './dto';

@Injectable()
export class QueueManagementService {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly identity: Identity,
  ) {}

  async findQueue(name: string): Promise<Queue> {
    if (!this.identity.isAdmin) {
      throw new UnauthorizedException();
    }

    try {
      const queue = this.moduleRef.get<Queue>(getQueueToken(name), {
        strict: false,
      });
      return queue;
    } catch (e) {
      throw new NotFoundException();
    }
  }
}

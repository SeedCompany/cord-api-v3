import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
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
    private readonly db: DatabaseService,
    @Logger('ceremony:service') private readonly logger: ILogger
  ) {}

  async readOne(id: string, session: ISession): Promise<Ceremony> {
    console.log('here i am');
    const result = await this.db.readProperties({
      session,
      id,
      nodevar: 'ceremony',
      aclReadNode: 'canReadCeremonies',
      props: [
        'id',
        'createdAt',
        'type',
        'planned',
        'estimatedDate',
        'actualDate',
      ],
    });

    if (!result) {
      throw new NotFoundException('Could not find ceremony');
    }

    return {
      id,
      createdAt: result.createdAt.value,
      type: result.type.value,
      planned: result.planned,
      estimatedDate: result.estimatedDate,
      actualDate: result.actualDate,
    };
  }

  async list(
    { page, count, sort, order, filter }: CeremonyListInput,
    session: ISession
  ): Promise<CeremonyListOutput> {
    const result = await this.db.list<Ceremony>({
      session,
      nodevar: 'ceremony',
      aclReadProp: 'canReadCeremonies',
      aclEditProp: 'canCreateCeremony',
      props: [
        { name: 'type', secure: false },
        { name: 'planned', secure: true },
        { name: 'estimatedDate', secure: true },
        { name: 'actualDate', secure: true },
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async create(input: CreateCeremony, session: ISession): Promise<Ceremony> {
    const id = generate();
    const acls = {
      canReadType: true,
      canEditType: true,
      canReadPlanned: true,
      canEditPlanned: true,
      canReadEstimatedDate: true,
      canEditEstimatedDate: true,
      canReadActualDate: true,
      canEditActualDate: true,
    };

    try {
      await this.db.createNode({
        session,
        type: Ceremony.classType,
        input: { id, ...input },
        acls,
      });

      return await this.readOne(id, session);
    } catch (e) {
      this.logger.warning('Failed to create ceremony', {
        exception: e,
      });

      throw e;
    }
  }

  async update(input: UpdateCeremony, session: ISession): Promise<Ceremony> {
    const object = await this.readOne(input.id, session);
    console.log('here in update');
    return this.db.updateProperties({
      session,
      object,
      props: ['type', 'planned', 'estimatedDate', 'actualDate'],
      changes: input,
      nodevar: 'ceremony',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find ceremony');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete ceremony', {
        exception: e,
      });
      throw e;
    }
  }
}

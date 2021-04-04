import { forwardRef, Inject, Injectable } from '@nestjs/common';
import * as faker from 'faker';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import { NotImplementedException, Session } from '../../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  OnIndex,
} from '../../../core';
import { AuthorizationService } from '../../authorization/authorization.service';
import { CreatePlanChange, PlanChange } from './dto';
import { ChangeListInput, SecuredChangeList } from './dto/change-list.dto';
import { PlanChangeStatus } from './dto/plan-change-status.enum';

@Injectable()
export class PlanChangeService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('project:plan-change:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [];
  }

  async create(
    _input: CreatePlanChange,
    _session: Session
  ): Promise<PlanChange> {
    throw new NotImplementedException();
  }

  async readOne(_id: string, _session: Session): Promise<PlanChange> {
    return {
      id: faker.random.uuid(),
      types: [],
      summary: faker.random.words(),
      status: PlanChangeStatus.Pending,
      createdAt: DateTime.now(),
      canDelete: true,
    };
  }

  async list(
    _projectId: string,
    _input: ChangeListInput,
    _session: Session
  ): Promise<SecuredChangeList> {
    const changes = await Promise.all(
      times(3).map(async () => await this.readOne('id', _session))
    );
    return {
      items: changes,
      total: 3,
      hasMore: false,
      canCreate: true,
      canRead: true,
    };
  }
}

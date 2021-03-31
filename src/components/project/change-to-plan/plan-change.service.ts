import { forwardRef, Inject, Injectable } from '@nestjs/common';
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
    throw new NotImplementedException();
  }
}

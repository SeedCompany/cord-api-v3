import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { DuplicateException, ServerException } from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  OnIndex,
  property,
  UniquenessError,
} from '../../core';

@Injectable()
export class AdminRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger
  ) {}
}

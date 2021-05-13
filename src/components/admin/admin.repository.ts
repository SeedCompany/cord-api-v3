import { Injectable } from '@nestjs/common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';

@Injectable()
export class AdminRepository {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('user:repository') private readonly logger: ILogger
  ) {}
}

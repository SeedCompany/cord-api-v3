import { UnauthorizedException as UnauthenticatedException } from '@nestjs/common';
import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { ISession, Session } from '../../common';
import { ConfigService, ILogger, Logger } from '../../core';
import { UserService } from '../user';
import { AdminService } from './admin.service';

@Resolver()
export class AdminResolver {
  constructor(
    private readonly config: ConfigService,
    private readonly admin: AdminService,
    @Logger('authentication:resolver') private readonly logger: ILogger
  ) {}

  @Mutation(() => Boolean, {
    description: 'Logout a user',
  })
  async runTest1(@Args('secret') secret: string): Promise<boolean> {
    if (secret === 'asdf') {
      await this.admin.runTest1();
      return true;
    }
    return false;
  }
}

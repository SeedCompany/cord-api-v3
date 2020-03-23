import { Test, TestingModule } from '@nestjs/testing';
import { CoreModule, LoggerModule } from '../../core';
import { OrganizationService } from './organization.service';
import { ISession } from '../auth';

describe('OrganizationService', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule],
      providers: [OrganizationService],
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  // READ ORG
  it('read organization by id', async () => {
    const orgId = '1234';
    
    const session = {token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ2OTY0MjM1ODl9.IzqfPHG9HsAH5hAei-IxmDRcPggtTDZJQjnd2JASM4E"};
    module.get(OrganizationService).readOne(orgId, session as ISession);
  });

  // DELETE ORG
  it('delete user', async () => {
    const orgId = '1234';
    
    const session = {token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ2OTY0MjM1ODl9.IzqfPHG9HsAH5hAei-IxmDRcPggtTDZJQjnd2JASM4E"};
    module.get(OrganizationService).delete(orgId, session as ISession);
  });
});
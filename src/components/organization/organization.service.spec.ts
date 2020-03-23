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
    const orgId = "GQiiEX_jZ";
    const session = { 
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
      userId: "C3DDouWkM",
      owningOrgId: "Seed Company",
    };

    try {
      //jest.spyOn(OrganizationService, 'readOne').mockImplementation((orgId, session as ISession) => result);
      const result = await module.get(OrganizationService).readOne(orgId, session as ISession);
    
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  // READ ORG
  it('read organization by id', async () => {
    const orgId = "GQiiEX_jZ";
    const session = { 
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
      userId: "C3DDouWkM",
      owningOrgId: "Seed Company",
    };

    try {
      //jest.spyOn(OrganizationService, 'readOne').mockImplementation((orgId, session as ISession) => result);
      const result = await module.get(OrganizationService).readOne(orgId, session as ISession);
    
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  // DELETE ORG
  it('delete user', async () => {
    const orgId = 'GQiiEX_jZ';
    
    const session = {
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI",
      userId: "C3DDouWkM",
      owningOrgId: "Seed Company",
    };
    const result = await module.get(OrganizationService).delete(orgId, session as ISession);
  });
});
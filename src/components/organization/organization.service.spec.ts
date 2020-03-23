import { Test, TestingModule } from '@nestjs/testing';
import { CoreModule, LoggerModule } from '../../core';
import * as faker from 'faker';
import { OrganizationService } from './organization.service';
import { ISession } from '../auth';
import {
  CreateOrganization,
  UpdateOrganization,
  OrganizationListInput,
} from './dto';

describe('OrganizationService', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule],
      providers: [OrganizationService],
    }).compile();

    // const session : ISession = { 
    //   token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
    //   userId: "C3DDouWkM",
    //   owningOrgId: "Seed Company",
    // };
  });

  afterEach(async () => {
    await module.close();
  });

  // CREATE ORG
  it('create an organization', async () => {
    const input = {name : faker.company.companyName()};
    const session = { 
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
      userId: "C3DDouWkM",
      owningOrgId: "Seed Company",
    };

    try {
      const result = await module.get(OrganizationService).create(input as CreateOrganization, session as ISession);
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  // READ ORG
  it('read organization by id', async () => {
    const input = {name : faker.company.companyName()};
    const session = { 
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
      userId: "C3DDouWkM",
      owningOrgId: "Seed Company",
    };

    try {
      const org1 = await module.get(OrganizationService).create(input as CreateOrganization, session as ISession);
      const org2 = await module.get(OrganizationService).readOne(org1.id, session as ISession);
      expect(org2.name.value).toEqual(org1.name.value);
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  // UPDATE ORG
  it('update organization', async () => {
    const input = {name : faker.company.companyName()};
    const session = { 
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
      userId: "C3DDouWkM",
      owningOrgId: "Seed Company",
    };

    try {
      const org1 = await module.get(OrganizationService).create(input as CreateOrganization, session as ISession);
      const inputNew = {id: org1.id, name : faker.company.companyName()};
      const org2 = await module.get(OrganizationService).update(inputNew as UpdateOrganization, session as ISession);
      expect(org2.name.value).toBe(inputNew.name);
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  // DELETE ORG
  it('delete organization', async () => {
    const input = {name : faker.company.companyName()};
    const session = { 
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
      userId: "C3DDouWkM",
      owningOrgId: "Seed Company",
    };
    try{
      const org1 = await module.get(OrganizationService).create(input as CreateOrganization, session as ISession);
      await module.get(OrganizationService).delete(org1.id, session as ISession);
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  // LIST ORGS
  it('list view of organizations', async () => {
    const input = { page : 1, count : 5, sort : "name", order : "DESC"};
    const session = { 
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
      userId: "C3DDouWkM",
      owningOrgId: "Seed Company",
    };
    try{
      module.get(OrganizationService).list(input as OrganizationListInput, session as ISession);
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

});
import { Test, TestingModule } from '@nestjs/testing';
import { CoreModule, LoggerModule } from '../../core';
import * as faker from 'faker';
import { EducationModule, EducationService } from './education';
import { UnavailabilityModule, UnavailabilityService } from './unavailability';
import { OrganizationModule, OrganizationService } from '../organization';
import { UserService } from './user.service';
import { ISession } from '../auth';
import {
  CreateUser,
  UpdateUser,
  UserListInput,
} from './dto';
import { FileService } from '../file';

describe('UserService', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule, EducationModule],
      providers: [UserService, EducationService],
    }).compile();
  });

  // beforeEach(async () => {
  //   module = await Test.createTestingModule({
  //     imports: [LoggerModule.forRoot(), CoreModule, OrganizationModule, EducationModule, UnavailabilityModule ],
  //     providers: [UserService, OrganizationService, EducationService, UnavailabilityService],
  //   }).compile();
  // });

  afterEach(async () => {
    await module.close();
  });

  // CREATE User
//   it('create a user', async () => {
//     const input = {name : faker.company.companyName()};
//     const session = { 
//       token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI",
//       owningOrgId: "Seed Company",
//     };

//     try {
//       const result = await module.get(UserService).create(input as CreateUser, session as ISession);
//     } catch (e) {
//       console.log(e);
//       throw e;
//     }
//   });

  // READ User
  it('read user by id', async () => {
    const input = {name : faker.company.companyName()};
    const session = { 
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
      owningOrgId: "Seed Company",
    };
    const id = "C3DDouWkM";
    module.get(UserService).readOne(id, session as ISession);

    // try {
    //   const user1 = await module.get(UserService).create(input as CreateUser, session as ISession);
    //   const user2 = await module.get(UserService).readOne(user1.id, session as ISession);
    //   expect(user2.name.value).toEqual(user1.name.value);
    // } catch (e) {
    //   console.log(e);
    //   throw e;
    // }
  });

  // UPDATE User
//   it('update user', async () => {
//     const input = {name : faker.company.companyName()};
//     const session = { 
//       token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI", 
//       owningOrgId: "Seed Company",
//     };

//     try {
//       const user1 = await module.get(UserService).create(input as CreateUser, session as ISession);
//       const inputNew = {id: user1.id, name : faker.company.companyName()};
//       const user2 = await module.get(UserService).update(inputNew as UpdateUser, session as ISession);
//       expect(user2.name.value).toBe(inputNew.name);
//     } catch (e) {
//       console.log(e);
//       throw e;
//     }
//   });

  // DELETE User
//   it('delete user', async () => {
//     const input = {name : faker.company.companyName()};
//     const session = { 
//       token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI",
//       owningOrgId: "Seed Company",
//     };
//     try{
//       const user1 = await module.get(UserService).create(input as CreateUser, session as ISession);
//       await module.get(UserService).delete(user1.id, session as ISession);
//     } catch (e) {
//       console.log(e);
//       throw e;
//     }
//   });

  // LIST UserS
//   it('list view of users', async () => {
//     const input = { page : 1, count : 5, sort : "name", order : "DESC"};
//     const session = { 
//       token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ5NTMxOTc0Mzl9.GqoNZAGzPpPhp1hs0Toi5bp8I2UUYHqR0FUrOxxLWFI",
//       owningOrgId: "Seed Company",
//     };
//     try{
//       module.get(UserService).list(input as UserListInput, session as ISession);
//     } catch (e) {
//       console.log(e);
//       throw e;
//     }
//   });

});
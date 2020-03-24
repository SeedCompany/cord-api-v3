import { Test, TestingModule } from '@nestjs/testing';
import { CoreModule, LoggerModule } from '../../core';
import * as faker from 'faker';
import { AuthModule} from '../auth/auth.module'
import { AuthService } from '../auth/auth.service'
import { EducationModule } from './education/education.module'
import { EducationService } from './education/education.service';
import { UnavailabilityModule } from './unavailability/unavailability.module';
import { UnavailabilityService } from './unavailability/unavailability.service';
import { OrganizationModule } from '../organization/organization.module';
import { OrganizationService } from '../organization/organization.service';
import { UserService } from './user.service';
import {
  CreateUser,
  UpdateUser,
  UserListInput,
} from './dto';
import {
  createSession,
  createTestApp,
  TestApp,
} from '../../../test/utility';
import { Session, ISession } from '../auth';
import { DateTime } from 'luxon';

describe('UserService', () => {
  let module: TestingModule;
  let session : ISession;

  beforeAll(async () => {

    module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule, EducationModule, OrganizationModule, UnavailabilityModule, AuthModule],
      providers: [UserService, EducationService, OrganizationService, UnavailabilityService, AuthService],
    }).compile();

    let app: TestApp;
    

    app = await createTestApp();
    const token = await createSession(app);
    session = {token, owningOrgId: "Seed Company", issuedAt : DateTime.local()}
  });
 
 

  afterAll(async () => {
    await module.close();
  });

  // CREATE User
  it('create a user', async () => {
    //const input = {name : faker.company.companyName()};
    const input = { 
      email: "test@test.com",
      realFirstName: "TestFirst",
      realLastName: "TestLast",
      displayFirstName: "Test First",
      displayLastName: "Test Last",
      password: "test@123",
      phone: "6464646464",
      timezone: "PST",
      bio: "bio-details"
    };
 
    // const session = { 
    //   token,
    //   owningOrgId: "Seed Company",
    // };

    try {
      const result = await module.get(UserService).create(input as CreateUser, session);
    } catch (e) {
      console.log(e);
      throw e;
    }
  });

  // READ User
  it('read user by id', async () => {
    const session = { 
      token : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUwNjIwMjgwNzR9.7c3xRjnrB-Y4TtVXZxYGk5nClebzLZsf_KS-h-XpKI4", 
      owningOrgId: "Seed Company",
    };
    const id = "C3DDouWkM";
    const result = await module.get(UserService).readOne(id, session as ISession);
    console.log(result);
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
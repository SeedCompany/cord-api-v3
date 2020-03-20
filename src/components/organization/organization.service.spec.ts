import { Test } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { Organization, } from './dto';
import { ISession, Session } from '../auth/session';

describe('OrganizationService', () => {
  let organizationService: OrganizationService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [OrganizationService],
      }).compile();

    organizationService = moduleRef.get<OrganizationService>(OrganizationService);
  });

  //describe('Check the existance of service', () => {

  it('should be defined', () => {
    expect(organizationService).toBeDefined();
  });

//   describe('Find an organization by its ID', () => {
//     // it('should return an organization', async () => {
//     //  // ISession {
//     //   //   token: string;
//     //   //   issuedAt: DateTime;
//     //   //   owningOrgId?: string;
//     //   //   userId?: string;
//     //   // }
//     //   let token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODQ2OTY0MjM1ODl9.IzqfPHG9HsAH5hAei-IxmDRcPggtTDZJQjnd2JASM4E';
//     //   let session : ISession;
//     //   session.token;
      
//     //   //const organization = `{organization : { name: "Seed" }`
//     //   const orgId = '1234';
//     //   const result = ['test'];
//     //   jest.spyOn(organizationService, 'readOne').mockImplementation((orgId, session) => Organization);

//     //   expect(await OrganizationService.readOne(session, orgId)).toBe(result);
//     // });
//   });
});
  
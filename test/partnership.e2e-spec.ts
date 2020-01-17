import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { generate, isValid } from 'shortid';
import { CreatePartnershipInput } from '../src/components/partnership/partnership.dto';
import { Partnership } from '../src/components/partnership/partnership';
import { Organization } from '../src/components/organization/organization';

async function createPartnership(app: INestApplication, organization: Organization): Promise<string> {
  let partshipId = '';
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      //ToDO : Use Later
      // query: `
      //   mutation {
      //     createPartnership(
      //       input: {
      //         partnership: {
      //           agreementStatus: AwaitingSignature
      //           mouStatus: Signed
      //           mouStart: null
      //           mouEnd: null
      //           organization: organization
      //           types: [Managing, Technical]
      //         }
      //       }
      //     ) {
      //       partnership {
      //         id
      //       }
      //     }
      //   }
      //   `,
      query: `
          mutation {
            createPartnership (input: { partnership: { organization: "${organization}" } }){
              partnership{
              id
              organization
              }
            }
          }
          `,
    })
    .then(({ body }) => {
      partshipId = body.data.createPartnership.partnership.id;
    });
  return partshipId;
}

describe('Partnership e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  // CREATE PARTNERSHIP
  it('create partnership', () => {
    const orgName = 'partshipName_' + generate();
    const organization = {id: generate(), name : orgName, owningOrg: null, createdAt: null, createdBy: null};
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createPartnership (input: { partnership: { organization: "${organization}" } }){
            partnership {
            id
            organization
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const partshipId = body.data.createPartnership.partnership.id;
        expect(isValid(partshipId)).toBe(true);
        expect(body.data.createPartnership.partnership.organization).toBe(orgName);
      })
      .expect(200);
  });

  // READ PARTNERSHIP
  it('read one partnership by id', async () => {
    const newPartShip = new CreatePartnershipInput();
    const orgName = 'partshipName_' + generate();
    newPartShip.organization = {id: generate(), name : orgName, owningOrg: null, createdAt: null, createdBy: null};
    const partshipId = await createPartnership(app, newPartShip.organization);

    // test reading new partnership
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readPartnership ( input: { partnership: { id: "${partshipId}" } }){
            partnership {
            id
            organization
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readPartnership.partnership.id).toBe(partshipId);
        expect(body.data.readPartnership.partnership.organization).toBe(newPartShip.organization);
      })
      .expect(200);
  });

  // UPDATE PARTNERSHIP
  it('update partnership', async () => {
    const newPartShip = new CreatePartnershipInput();
    const orgName = 'partshipName_' + generate();
    newPartShip.organization = {id: generate(), name : orgName, owningOrg: null, createdAt: null, createdBy: null};
    const partshipId = await createPartnership(app, newPartShip.organization);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updatePartnership (input: { partnership: {id: "${partshipId}", organization: "${newPartShip.organization}" } }){
            partnership {
            id
            organization
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updatePartnership.partnership.id).toBe(partshipId);
        expect(body.data.updatePartnership.partnership.organization).toBe(
          newPartShip.organization,
        );
      })
      .expect(200);
  });

  // DELETE PARTNERSHIP
  it('delete partnership', async () => {
    const newPartShip = new CreatePartnershipInput();
    const orgName = 'partshipName_' + generate();
    newPartShip.organization = {id: generate(), name : orgName, owningOrg: null, createdAt: null, createdBy: null};
    const partshipId = await createPartnership(app, newPartShip.organization);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deletePartnership (input: { partnership: { id: "${partshipId}" } }){
            partnership {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deletePartnership.partnership.id).toBe(partshipId);
      })
      .expect(200);
  });

  // LIST PARTNERSHIPS
  // it('list view of partnerships', async () => {
  //   // create a bunch of partnership
  //   const totalOrgs = 10;
  //   const orgs: Partnership[] = [];
  //   for (let i = 0; i < totalOrgs; i++) {
  //     const newPartShip = new Partnership();
  //     const orgName = 'partshipName_' + generate();
  //     newPartShip.organization = {id: generate(), name : orgName, owningOrg: null, createdAt: null, createdBy: null};
  //     //newPartShip.id = await createPartnership(app, newPartShip.organization);
  //     orgs.push(newPartShip);
  //   }

  //   // test reading new partnership
  //   return request(app.getHttpServer())
  //     .post('/graphql')
  //     .send({
  //       operationName: null,
  //       query: `
  //       query {
  //         partnerships(
  //           input: {
  //             query: { filter: "", page: 0, count: ${totalOrgs}, sort: "organization", order: "asc" }
  //           }
  //         ) {
  //           partnerships {
  //             id
  //             organization
  //           }
  //         }
  //       }
  //         `,
  //     })
  //     .expect(({ body }) => {
  //       expect(body.data.partnerships.partnerships.length).toBe(totalOrgs);
  //     })
  //     .expect(200);
  // });

  afterAll(async () => {
    await app.close();
  });
});

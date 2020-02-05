import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { generate, isValid } from 'shortid';
import { createTestApp, TestApp } from './utility';

async function createBudget(
  app: INestApplication,
  budgetStatus: string,
): Promise<string> {
  let budgetId = '';
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
      createBudget (input: { budget: { status: Pending } }){
        budget {
        id
        }
      }
    }
    `,
    })
    .then(({ body }) => {
      budgetId = body.data.createBudget.budget.id;
    });
  return budgetId;
}

describe.skip('Budget e2e', () => {
  let app: TestApp;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('create budget', async () => {
    const budgetStatus = 'Pending';
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createBudget (input: { budget: { status: ${budgetStatus} } }){
            budget {
            id
            status
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const budgetId = body.data.createBudget.budget.id;
        expect(isValid(budgetId)).toBe(true);
        expect(body.data.createBudget.budget.status).toBe(budgetStatus);
      })
      .expect(200);
  });

  it('read one budget by id', async () => {
    const budgetStatus = 'Pending';

    // create budget first
    const budgetId = await createBudget(app, budgetStatus);

    // test reading new org
    await request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readBudget ( input: { budget: { id: "${budgetId}" } }){
            budget{
            id
            status
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readBudget.budget.id).toBe(budgetId);
        expect(body.data.readBudget.budget.status).toBe(budgetStatus);
      })
      .expect(200);
  });

  it('update budget', async () => {
    const budgetStatus = 'Pending';
    const budgetStatusNew = 'Current';

    // create budget first
    const budgetId = await createBudget(app, budgetStatus);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateBudget (input: { budget: {
            id: "${budgetId}",
            status: ${budgetStatusNew}
          } }){
            budget {
            id
            status
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateBudget.budget.id).toBe(budgetId);
        expect(body.data.updateBudget.budget.status).toBe(budgetStatusNew);
      })
      .expect(200);
  });

  it('delete budget', async () => {
    const budgetStatus = 'budgetStatus' + Date.now();

    // create budget first
    const budgetId = await createBudget(app, budgetStatus);

    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteBudget (input: { budget: { id: "${budgetId}" } }){
            budget {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteBudget.budget.id).toBe(budgetId);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});

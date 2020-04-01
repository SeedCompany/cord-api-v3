import { createSession, createTestApp, createUser, TestApp } from './utility';
import {
  createInternshipEngagement,
  createLanguageEngagement,
} from './utility/create-engagement';

describe('Engagement e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('create a language engagement', async () => {
    const lanaugeEngagement = await createLanguageEngagement(app);
    expect(lanaugeEngagement.id).toBeDefined();
  });

  it('create a internship engagement', async () => {
    const internEngagement = await createInternshipEngagement(app);
    expect(internEngagement.id).toBeDefined();
  });
});

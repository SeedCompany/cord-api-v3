import { createSession, createTestApp, createUser, TestApp } from './utility';
import { createLanguageEngagement } from './utility/create-language-engagement';

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
});

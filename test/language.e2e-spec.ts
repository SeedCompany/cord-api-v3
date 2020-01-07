import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { GraphQLModule } from '@nestjs/graphql';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { isValid } from 'shortid';
import { DatabaseService } from '../src/core/database.service';
import { DatabaseUtility } from '../src/common/database-utility';
import { LanguageService } from '../src/components/language/language.service';
import { CreateLanguageInput } from '../src/components/language/language.dto';

describe('Language e2e', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let dbUtility: DatabaseUtility;
  let langService: LanguageService;

  beforeAll(async () => {
    db = new DatabaseService();
    langService = new LanguageService(db);
    dbUtility = new DatabaseUtility(db, langService);
    //await dbUtility.resetDatabaseForTesting();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('create language', () => {
    const langName = 'bestLangEver12345';
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          createLanguage (input: { language: { name: "${langName}" } }){
            language{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        const langId = body.data.createLanguage.language.id;
        expect(isValid(langId)).toBe(true);
        expect(body.data.createLanguage.language.name).toBe(langName);
      })
      .expect(200);
  });

  it('read one language by id', async () => {
    const newLang = new CreateLanguageInput();
    newLang.name = 'langNameForReadLangTest1';
    const createdLang = await langService.create(newLang);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readLanguage ( input: { language: { id: "${createdLang.language.id}" } }){
            language{
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readLanguage.language.id).toBe(createdLang.language.id);
        expect(body.data.readLanguage.language.name).toBe(createdLang.language.name);
      })
      .expect(200);
  });

  it('update language', async () => {
    const newLang = new CreateLanguageInput();
    newLang.name = 'langNameForUpdateLangTest1';
    const createdLang = await langService.create(newLang);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          updateLanguage (input: { language: {id: "${createdLang.language.id}", name: "${createdLang.language.name}" } }){
            language {
            id
            name
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.updateLanguage.language.id).toBe(createdLang.language.id);
        expect(body.data.updateLanguage.language.name).toBe(createdLang.language.name);
      })
      .expect(200);
  });

  it('delete language', async () => {
    const newLang = new CreateLanguageInput();
    newLang.name = 'langNameForDeleteLangTest1';
    const createdLang = await langService.create(newLang);
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        mutation {
          deleteLanguage (input: { language: { id: "${createdLang.language.id}" } }){
            language {
            id
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.deleteLanguage.language.id).toBe(createdLang.language.id);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});

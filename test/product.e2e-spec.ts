import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { generate, isValid } from 'shortid';
import { Product } from 'src/components/product/product';
import { ProductType } from 'src/components/product/product-type';
import { BibleBook } from 'src/components/product/bible-book';
import { ProductApproach } from 'src/components/product/product-approach';
import { ProductMedium } from 'src/components/product/product-medium';
import { ProductMethodology } from 'src/components/product/product-methodology';
import { ProductPurpose } from 'src/components/product/product-purpose';

async function createProduct(app: INestApplication): Promise<Product> {
  const product = new Product();
  await request(app.getHttpServer())
    .post('/graphql')
    .send({
      operationName: null,
      query: `
    mutation {
        createProduct (input: { product: { type: BibleStories,books:[Genesis],mediums:[Print],purposes:[ChurchLife],approach:Written,methodology:Paratext }}){
        product {
        id
        type
        }
      }
    }
    `,
    })
    .then(({ body }) => {
      product.id = body.data.createProduct.product.id;
      expect(isValid(product.id)).toBe(true);
      expect(body.data.createProduct.product.type).toBe('BibleStories');
    });
  return product;
}

describe('Product e2e', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('read one product by id', async () => {
    const product = await createProduct(app);
    const type = 'BibleStories';
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        operationName: null,
        query: `
        query {
          readProduct ( input: { product: { id: "${product.id}" } }){
            product{
              id
              type,
              books,
              mediums,
              purposes,
              approach,
              methodology
            }
          }
        }
        `,
      })
      .expect(({ body }) => {
        expect(body.data.readProduct.product.id).toBe(product.id);
        expect(body.data.readProduct.product.type).toBe(type);
      })
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});

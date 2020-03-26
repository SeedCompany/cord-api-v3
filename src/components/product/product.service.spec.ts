import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import {
  BibleBook,
  Product,
  ProductMedium,
  ProductMethodology,
  ProductPurpose,
  ProductType,
} from './dto';
import { ProductService } from './product.service';

describe('ProductService', () => {
  let productService: ProductService;
  const id = generate();
  const createTestProduct: Partial<Product> = {
    id,
    type: ProductType.BibleStories,
    books: [BibleBook.Genesis],
    mediums: [ProductMedium.Print],
    purposes: [ProductPurpose.ChurchLife],
    methodology: ProductMethodology.Paratext,
  };

  const updateTestProduct: Partial<Product> = {
    id,
    type: ProductType.JesusFilm,
    books: [BibleBook.Exodus],
    mediums: [ProductMedium.Web],
    purposes: [ProductPurpose.ChurchMaturity],
    methodology: ProductMethodology.OtherWritten,
  };

  const mockDbService = {
    createNode: () => createTestProduct,
    updateProperties: () => updateTestProduct,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
      }),
    }),
    readProperties: () => createTestProduct,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule, ProductService],
      providers: [
        ProductService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    productService = module.get<ProductService>(ProductService);
  });

  it('should be defined', () => {
    expect(ProductService).toBeDefined();
  });

  it('should create product node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    productService.readOne = jest.fn().mockReturnValue(createTestProduct);

    const product = await productService.create(
      {
        type: ProductType.BibleStories,
        books: [BibleBook.Genesis],
        mediums: [ProductMedium.Print],
        purposes: [ProductPurpose.ChurchLife],
        methodology: ProductMethodology.Paratext,
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(product.type).toEqual(createTestProduct.type);
    expect(product.books).toEqual(createTestProduct.books);
    expect(product.mediums).toEqual(createTestProduct.mediums);
    expect(product.purposes).toEqual(createTestProduct.purposes);
    expect(product.methodology).toEqual(createTestProduct.methodology);
  });

  it('should read product node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    productService.readOne = jest.fn().mockReturnValue(createTestProduct);
    const product = await productService.readOne(id, {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: '12345',
      issuedAt: DateTime.local(),
    });
    expect(product.id).toEqual(createTestProduct.id);
    expect(product.type).toEqual(createTestProduct.type);
    expect(product.books).toEqual(createTestProduct.books);
    expect(product.mediums).toEqual(createTestProduct.mediums);
    expect(product.purposes).toEqual(createTestProduct.purposes);
    expect(product.methodology).toEqual(createTestProduct.methodology);
  });

  it.skip('should update product node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    productService.readOne = jest.fn().mockReturnValue(createTestProduct);

    const product = await productService.update(
      {
        id,
        type: ProductType.JesusFilm,
        books: [BibleBook.Exodus],
        mediums: [ProductMedium.Web],
        purposes: [ProductPurpose.ChurchMaturity],
        methodology: ProductMethodology.OtherWritten,
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(product.type).toEqual(updateTestProduct.type);
    expect(product.books).toEqual(updateTestProduct.books);
    expect(product.mediums).toEqual(updateTestProduct.mediums);
    expect(product.purposes).toEqual(updateTestProduct.purposes);
    expect(product.methodology).toEqual(updateTestProduct.methodology);
  });

  it('should delete product node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    productService.readOne = jest.fn().mockReturnValue(createTestProduct);

    await productService.delete(id, {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: '12345',
      issuedAt: DateTime.local(),
    });
  });
});

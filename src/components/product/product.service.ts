import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/core/database.service';
import {
  CreateProductInput,
  CreateProductInputDto,
  CreateProductOutputDto,
  DeleteProductInput,
  DeleteProductInputDto,
  DeleteProductOutputDto,
  ReadProductInput,
  ReadProductInputDto,
  ReadProductOutputDto,
  UpdateProductInput,
  UpdateProductInputDto,
  UpdateProductOutputDto,
} from './product.dto';
import { generate } from 'shortid';

@Injectable()
export class ProductService {
  constructor(private readonly db: DatabaseService) {}
  async create(input: CreateProductInput): Promise<CreateProductOutputDto> {
    const response = new CreateProductOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (product:Product {active: true, owningOrg: "seedcompany", id: $id}) ON CREATE SET product.id = $id, product.type  = $type, product.books=$books,product.mediums = $mediums,product.purposes=$purposes,product.approach=$approach,product.methodology=$methodology, product.timestamp = datetime() RETURN product.id as id, product.type as type,product.books as books, product.mediums as mediums,product.purposes as purposes,product.approach as approach, product.methodology as methodology',
        {
          id,
          type: input.type,
          books: input.books,
          mediums: input.mediums,
          purposes: input.purposes,
          approach: input.approach,
          methodology: input.methodology,
        },
      )
      .then(result => {
        response.product.id = result.records[0].get('id');
        response.product.type = result.records[0].get('type');
        response.product.books = result.records[0].get('books');
        response.product.mediums = result.records[0].get('mediums');
        response.product.purposes = result.records[0].get('purposes');
        response.product.approach = result.records[0].get('approach');
        response.product.methodology = result.records[0].get('methodology');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(input: ReadProductInput): Promise<ReadProductOutputDto> {
    const response = new ReadProductOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (product:Product {active: true, owningOrg: "seedcompany"}) WHERE product.id = "${input.id}" RETURN product.id as id, product.type as type,product.books as books, product.mediums as mediums,product.purposes as purposes,product.approach as approach, product.methodology as methodology`,
        {
          id: input.id,
        },
      )
      .then(result => {
        response.product.id = result.records[0].get('id');
        response.product.type = result.records[0].get('type');
        response.product.books = result.records[0].get('books');
        response.product.mediums = result.records[0].get('mediums');
        response.product.purposes = result.records[0].get('purposes');
        response.product.approach = result.records[0].get('approach');
        response.product.methodology = result.records[0].get('methodology');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateProductInput): Promise<UpdateProductOutputDto> {
    const response = new UpdateProductOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `MATCH (product:Product {active: true, owningOrg: "seedcompany", id: $id}) SET product.type = $type, product.books=$books,product.mediums = $mediums,product.purposes=$purposes,product.approach=$approach,product.methodology=$methodology  RETURN product.id as id, product.type as type,product.books as books, product.mediums as mediums,product.purposes as purposes,product.approach as approach, product.methodology as methodology`,
        {
          id: input.id,
          type: input.type,
          books: input.books,
          mediums: input.mediums,
          purposes: input.purposes,
          approach: input.approach,
          methodology: input.methodology,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.product.id = result.records[0].get('id');
          response.product.type = result.records[0].get('type');
          response.product.books = result.records[0].get('books');
          response.product.mediums = result.records[0].get('mediums');
          response.product.purposes = result.records[0].get('purposes');
          response.product.approach = result.records[0].get('approach');
          response.product.methodology = result.records[0].get('methodology');
        } else {
          response.product = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(input: DeleteProductInput): Promise<DeleteProductOutputDto> {
    const response = new DeleteProductOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (product:Product {active: true, owningOrg: "seedcompany", id: $id}) SET product.active = false RETURN product.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.product.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }
}

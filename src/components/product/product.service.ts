import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/core/database.service';
import { CreateProductInput, CreateProductOutputDto } from './product.dto';
import { generate } from 'shortid';

@Injectable()
export class ProductService {
  constructor(private readonly db: DatabaseService) {}

  async create(input: CreateProductInput): Promise<CreateProductOutputDto> {
    const response = new CreateProductOutputDto();
    const session = this.db.driver.session();
    const id = generate();

    const result = await session.run(`
    CREATE (product:Product {
      active: true,
      createdAt: datetime(),
      id: $id
    })
    WITH *
    CREATE (product)-
      [:type {
        active: true,
        createdAt: datetime()
      }]->
      (:ProductType {value: $name})
    WITH *
    FOREACH (n IN $books |
      CREATE (product)-
      [:book {active: true, createdAt: datetime()}]->
      (:BibleBook {value: n})
    )
    WITH *
    FOREACH (n IN $mediums |
      CREATE (product)-
      [:medium {active: true, createdAt: datetime()}]->
      (:ProductMedium {value: n})
    )
    WITH *
    FOREACH (n IN $purposes |
      CREATE (product)-
      [:purpose {active: true, createdAt: datetime()}]->
      (:ProductPurpose {value: n})
    )
    WITH *
    CREATE (product)-
      [:approach {active: true, createdAt: datetime()}]->
      (:ProductApproach {value: $approach})
    WITH *
    CREATE (product)-
      [:methodology {active: true, createdAt: datetime()}]->
      (:ProductMethodology {value: $methodology})
    RETURN product.id as id
  `, {
      id,
      name: input.type,
      books: input.books,
      mediums: input.mediums,
      purposes: input.purposes,
      approach: input.approach,
      methodology: input.methodology,
    });

    session.close();

    response.product.id = result.records[0].get('id');

    return response;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, PropertyUpdaterService } from '../../core';
import { generate } from 'shortid';
import { ISession } from '../auth';
import { Product, CreateProduct, UpdateProduct } from './dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly db: DatabaseService,
    private readonly propertyUpdater: PropertyUpdaterService,
  ) {}


  async create(input: CreateProduct, session: ISession): Promise<Product> {
    const id = generate();
    const acls = {
      canReadType: true,
      canEditType: true,
      canReadBooks: true,
      canEditBooks: true,
      canReadMediums: true,
      canEditMediums: true,
      canReadPurposes: true,
      canEditPurposes: true,
      canReadApproach: true,
      canEditApproach: true,
      canReadMethodology: true,
      canEditMethodology: true,
    };

    try {
      await this.propertyUpdater.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Product',
        aclEditProp: 'canCreateProduct',
      });
    } catch (e) {
      console.log(e);
      throw new Error('Could not create product');
    }

    return await this.readOne(id, session);
  }

  async readOne(id: string, session: ISession): Promise<Product> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
        (token:Token {
          active: true,
          value: $token
        })
          <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId,
          owningOrgId: $owningOrgId
        }),
        (prod:Product {active: true, id: $id})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl1:ACL {canReadType: true})-[:toNode]->(prod)-[:type {active: true}]->(type:Property {active: true})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl2:ACL {canReadBooks: true})-[:toNode]->(prod)-[:books {active: true}]->(books:Property {active: true})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl3:ACL {canReadMediums: true})-[:toNode]->(prod)-[:mediums {active: true}]->(mediums:Property {active: true})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl4:ACL {canReadPurposes: true})-[:toNode]->(prod)-[:purposes {active: true}]->(purposes:Property {active: true})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl5:ACL {canReadApproach: true})-[:toNode]->(prod)-[:approach {active: true}]->(approach:Property {active: true})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl6:ACL {canReadMethodology: true})-[:toNode]->(prod)-[:methodology {active: true}]->(methodology:Property {active: true})
        RETURN
          prod.id as id,
          prod.createdAt as createdAt,
          type.value as type,
          books.value as books,
          mediums.value as mediums,
          purposes.value as purposes,
          approach.value as approach,
          methodology.value as methodology,
          acl1.canReadType as canReadType,
          acl2.canReadBooks as canReadBooks,
          acl3.canReadMediums as canReadMediums,
          acl4.canReadPurposes as canReadPurposes,
          acl5.canReadApproach as canReadApproach,
          acl6.canReadMethodology as canReadMethodology
        `,
        {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          id,
        },
      )
      .first();
    if (!result) {
      throw new NotFoundException('Could not find product');
    }

    return {
      id,
      createdAt: result.createdAt,
      type: result.type,
      books: result.books.split(','),
      mediums: result.mediums.split(','),
      purposes: result.purposes.split(','),
      approach: result.approach,
      methodology: result.methodology,
    };
  }

  async update(input: UpdateProduct, session: ISession): Promise<Product> {
    const object = await this.readOne(input.id, session);

    return this.propertyUpdater.updateProperties({
      session,
      object,
      props: ['type', 'books', 'mediums', 'purposes', 'approach', 'methodology'],
      changes: input,
      nodevar: 'product',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find product');
    }

    try {
      await this.propertyUpdater.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
}

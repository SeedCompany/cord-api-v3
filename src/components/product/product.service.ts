import { Injectable, NotFoundException } from '@nestjs/common';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import {
  CreateProduct,
  MethodologyToApproach,
  Product,
  ProductListInput,
  ProductListOutput,
  UpdateProduct,
} from './dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('product:service') private readonly logger: ILogger
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
      canReadMethodology: true,
      canEditMethodology: true,
    };

    try {
      await this.db.createNode({
        session,
        type: Product.classType,
        input: {
          id,
          ...input,
          ...(input.methodology
            ? { approach: MethodologyToApproach[input.methodology] }
            : {}),
        },
        acls,
      });
    } catch (e) {
      this.logger.warning('Failed to create product', {
        exception: e,
      });

      throw new Error('Could not create product');
    }

    return this.readOne(id, session);
  }

  async readOne(id: string, session: ISession): Promise<Product> {
    const result = await this.db.readProperties({
      session,
      id,
      nodevar: 'product',
      props: [
        'id',
        'createdAt',
        'type',
        'books',
        'mediums',
        'purposes',
        'approach',
        'methodology',
      ],
    });

    if (!result) {
      throw new NotFoundException('Could not find product');
    }

    return {
      id,
      createdAt: result.createdAt.value,
      type: result.type.value,
      books: result.books?.value || [],
      mediums: result.mediums?.value || [],
      purposes: result.purposes?.value || [],
      approach: result.approach.value,
      methodology: result.methodology.value,
    };
  }

  async list(
    { page, count, sort, order, filter }: ProductListInput,
    session: ISession
  ): Promise<ProductListOutput> {
    const result = await this.db.list<Product>({
      session,
      nodevar: 'product',
      aclReadProp: 'canReadProducts',
      aclEditProp: 'canCreateProduct',
      props: [
        { name: 'type', secure: false },
        { name: 'books', secure: false, list: true },
        { name: 'mediums', secure: false, list: true },
        { name: 'purposes', secure: false, list: true },
        { name: 'approach', secure: false },
        { name: 'methodology', secure: false },
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async update(input: UpdateProduct, session: ISession): Promise<Product> {
    const object = await this.readOne(input.id, session);

    return this.db.updateProperties({
      session,
      object,
      props: [
        'type',
        'books',
        'mediums',
        'purposes',
        'approach',
        'methodology',
      ],
      changes: {
        ...input,
        ...(input.methodology
          ? { approach: MethodologyToApproach[input.methodology] }
          : {}),
      },
      nodevar: 'product',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find product');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete product', {
        exception: e,
      });
      throw e;
    }
  }
}

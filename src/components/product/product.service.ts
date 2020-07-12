import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { Node, node, relation } from 'cypher-query-builder';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger, matchSession } from '../../core';
import {
  AnyProduct,
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

  async create(input: CreateProduct, session: ISession): Promise<AnyProduct> {
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
        type: Product,
        input: {
          id,
          ...input,
          ...(input.methodology
            ? { approach: MethodologyToApproach[input.methodology] }
            : {}),
        },
        acls,
      });

      if (input.produces) {
        await this.db
          .query()
          .match([
            [node('product', 'Product', { id, active: true })],
            [node('pr', 'Producible', { id: input.produces, active: true })],
          ])
          .create([
            node('product'),
            relation('out', '', 'produces', {
              active: true,
              createdAt: DateTime.local(),
            }),
            node('pr'),
          ])
          .run();
      }
    } catch (e) {
      this.logger.warning('Failed to create product', {
        exception: e,
      });

      throw new ServerException('Failed to create product');
    }

    return this.readOne(id, session);
  }

  async readOne(id: string, session: ISession): Promise<AnyProduct> {
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

    if (!result || !result.id) {
      this.logger.warning(`Could not find product`, { id: id });
      throw new NotFoundException('Could not find product');
    }

    return {
      id,
      createdAt: result.createdAt.value,
      mediums: {
        value: result.mediums?.value || [],
        canRead: true,
        canEdit: true,
      },
      purposes: {
        value: result.purposes?.value || [],
        canRead: true,
        canEdit: true,
      },
      methodology: {
        value: result.methodology.value,
        canRead: true,
        canEdit: true,
      },
      scriptureReferences: {
        // TODO
        canRead: true,
        canEdit: true,
        value: [],
      },
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
        { name: 'mediums', secure: true, list: true },
        { name: 'purposes', secure: true, list: true },
        { name: 'methodology', secure: true },
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    let items = result.items.map((item) => ({
      ...item,
      scriptureReferences: {
        // TODO
        canRead: true,
        canEdit: true,
        value: [],
      },
    }));

    // TODO this is bad, we should at least fetch the the producible IDs in the
    // list query above. Then we may have to call each service to fully hydrate
    // the object (film, story, song, etc.).
    // This logic also needs to be applied to readOne()
    items = await Promise.all(
      items.map(async (item) => {
        const produces = await this.db
          .query()
          .match([
            node('product', 'Product', { id: item.id, active: true }),
            relation('out', 'produces', { active: true }),
            node('p', 'Producible', { active: true }),
          ])
          .return('p')
          .asResult<{ p: Node<{ id: string; createdAt: DateTime }> }>()
          .first();
        if (!produces) {
          return item;
        }
        return {
          ...item,
          produces: {
            value: {
              id: produces.p.properties.id,
              createdAt: produces.p.properties.createdAt,
              __typename: difference(produces.p.labels, [
                'Producible',
                'BaseNode',
              ])[0],
            },
          },
        };
      })
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async update(input: UpdateProduct, session: ISession): Promise<AnyProduct> {
    // TODO scriptureReferences, produces
    const { produces, scriptureReferences, ...rest } = input;

    const object = await this.readOne(input.id, session);

    return this.db.updateProperties({
      session,
      object,
      props: ['mediums', 'purposes', 'methodology'],
      changes: rest,
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
      throw new ServerException('Failed to delete product');
    }
  }
}

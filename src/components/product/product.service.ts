import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ISession } from '../../common';
import {
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  addPropertyCoalesceWithClause,
  addUserToSG,
  ConfigService,
  createBaseNode,
  createSG,
  DatabaseService,
  filterByEngagement,
  filterByString,
  ILogger,
  listWithSecureObject,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  Property,
  runListQuery,
} from '../../core';
import {
  AnyProduct,
  CreateProduct,
  Product,
  ProductListInput,
  ProductListOutput,
  UpdateProduct,
} from './dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('product:service') private readonly logger: ILogger
  ) {}

  async create(input: CreateProduct, session: ISession): Promise<AnyProduct> {
    // create product
    const secureProps: Property[] = [
      {
        key: 'mediums',
        value: input.mediums,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'Mediums',
      },
      {
        key: 'purposes',
        value: input.purposes,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'Purposes',
      },
      {
        key: 'methodology',
        value: input.methodology,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'Methodology',
      },
    ];
    // const baseMetaProps = [];

    const query = this.db
      .query()
      .match([
        node('root', 'User', { active: true, id: this.config.rootAdmin.id }),
      ])
      .match([
        node('publicSG', 'PublicSecurityGroup', {
          active: true,
          id: this.config.publicSecurityGroup.id,
        }),
      ])
      .call(matchRequestingUser, session)
      .call(createSG, 'orgSG', 'OrgPublicSecurityGroup')
      .call(createBaseNode, 'Product', secureProps)
      .call(addUserToSG, 'requestingUser', 'adminSG') // must come after base node creation
      .return('node.id as id');

    const result = await query.first();

    if (!result) {
      throw new ServerException('failed to create default product');
    }

    const id = result.id;

    // add root admin to new product as an admin
    await this.db.addRootAdminToBaseNodeAsAdmin(id, 'Product');

    this.logger.debug(`product created, id ${id}`);

    return this.readOne(id, session);
    // try {
    //   await this.db.createNode({
    //     session,
    //     type: Product,
    //     input: {
    //       id,
    //       ...input,
    //       ...(input.methodology
    //         ? { approach: MethodologyToApproach[input.methodology] }
    //         : {}),
    //     },
    //     acls,
    //   });

    //   if (input.produces) {
    //     await this.db
    //       .query()
    //       .match([
    //         [node('product', 'Product', { id, active: true })],
    //         [node('pr', 'Producible', { id: input.produces, active: true })],
    //       ])
    //       .create([
    //         node('product'),
    //         relation('out', '', 'produces', {
    //           active: true,
    //           createdAt: DateTime.local(),
    //         }),
    //         node('pr'),
    //       ])
    //       .run();
    //   }
    // } catch (e) {
    //   this.logger.warning('Failed to create product', {
    //     exception: e,
    //   });

    //   throw new ServerException('Failed to create product');
    // }

    // return this.readOne(id, session);
  }

  async readOne(id: string, session: ISession): Promise<AnyProduct> {
    const props = ['mediums', 'purposes', 'methodology'];
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'Product', id)
      .call(addAllSecureProperties, ...props)
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        'coalesce(node.id) as id',
        'coalesce(node.createdAt) as createdAt',
      ])
      .returnDistinct([...props, 'id', 'createdAt']);

    const result = (await query.first()) as Product | undefined;
    if (!result || !result.id) {
      this.logger.warning(`Could not find product`, { id: id });
      throw new NotFoundException('Could not find product');
    }

    return {
      ...result,
      scriptureReferences: {
        // TODO
        canRead: true,
        canEdit: true,
        value: [],
      },
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

  async list(
    { filter, ...input }: ProductListInput,
    session: ISession
  ): Promise<ProductListOutput> {
    const label = 'Product';
    const baseNodeMetaProps = ['id', 'createdAt'];
    // const unsecureProps = [''];
    const secureProps = ['mediums', 'purposes', 'methodology'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'Product');

    if (filter.methodology) {
      query.call(filterByString, label, 'methodology', filter.methodology);
    } else if (filter.approach) {
      query.call(filterByString, label, 'approach', filter.approach);
    } else if (filter.engagementId) {
      query.call(
        filterByEngagement,
        filter.engagementId,
        'engagement',
        'out',
        label
      );
    }

    // match on the rest of the properties of the object requested
    query
      .call(
        addAllSecureProperties,
        ...secureProps
        //...unsecureProps
      )

      // form return object
      // ${listWithUnsecureObject(unsecureProps)}, // removed from a few lines down
      .with(
        `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithSecureObject(secureProps)}
          } as node
        `
      );

    const result = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );

    const items = result.items.map((item) => ({
      ...(item as Product),
      scriptureReferences: {
        // TODO
        canRead: true,
        canEdit: true,
        value: [],
      },
    }));

    // // TODO this is bad, we should at least fetch the the producible IDs in the
    // // list query above. Then we may have to call each service to fully hydrate
    // // the object (film, story, song, etc.).
    // // This logic also needs to be applied to readOne()
    // items = await Promise.all(
    //   items.map(async (item) => {
    //     const produces = await this.db
    //       .query()
    //       .match([
    //         node('product', 'Product', { id: item.id, active: true }),
    //         relation('out', 'produces', { active: true }),
    //         node('p', 'Producible', { active: true }),
    //       ])
    //       .return('p')
    //       .asResult<{ p: Node<{ id: string; createdAt: DateTime }> }>()
    //       .first();
    //     if (!produces) {
    //       return item;
    //     }
    //     return {
    //       ...item,
    //       produces: {
    //         value: {
    //           id: produces.p.properties.id,
    //           createdAt: produces.p.properties.createdAt,
    //           __typename: difference(produces.p.labels, [
    //             'Producible',
    //             'BaseNode',
    //           ])[0],
    //         },
    //       },
    //     };
    //   })
    // );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}

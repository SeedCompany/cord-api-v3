import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import { ISession } from '../../common';
import {
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  ConfigService,
  createBaseNode,
  DatabaseService,
  filterByString,
  filterBySubarray,
  ILogger,
  listWithSecureObject,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  Property,
  runListQuery,
} from '../../core';
import { ScriptureRange } from '../scripture';
import {
  scriptureToVerseRange,
  verseToScriptureRange,
} from '../scripture/reference';
import {
  AnyProduct,
  CreateProduct,
  MethodologyToApproach,
  ProducibleType,
  Product,
  ProductApproach,
  ProductListInput,
  ProductListOutput,
  ProductMethodology,
  UpdateProduct,
} from './dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('product:service') private readonly logger: ILogger
  ) {}

  permission = (property: string, nodeName: string, canEdit = false) => {
    const createdAt = DateTime.local().toString();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(nodeName),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: canEdit,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(nodeName),
      ],
    ];
  };

  async create(
    { engagementId, ...input }: CreateProduct,
    session: ISession
  ): Promise<AnyProduct> {
    const createdAt = DateTime.local().toString();
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
        label: 'ProductMedium',
      },
      {
        key: 'purposes',
        value: input.purposes,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'ProductPurpose',
      },
      {
        key: 'methodology',
        value: input.methodology,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'ProductMethodology',
      },
    ];

    const query = this.db
      .query()
      .match([
        node('root', 'User', { active: true, id: this.config.rootAdmin.id }),
      ]);

    if (engagementId) {
      query.match([
        node('engagement', 'Engagement', { active: true, id: engagementId }),
      ]);
    }

    if (input.produces) {
      const produce = await this.db
        .query()
        .match([node('pr', 'Producible', { id: input.produces, active: true })])
        .return('pr')
        .first();
      if (!produce) {
        this.logger.warning(`Could not find producible node`, {
          id: input.produces,
        });
        throw new NotFoundException('Could not find producible node');
      }
      query.match([
        node('pr', 'Producible', { id: input.produces, active: true }),
      ]);
    }

    query
      .call(matchRequestingUser, session)
      .call(
        createBaseNode,
        [
          'Product',
          input.produces
            ? 'DerivativeScriptureProduct'
            : 'DirectScriptureProduct',
        ],
        secureProps,
        {
          owningOrgId: session.owningOrgId,
        }
      );

    if (engagementId) {
      query.create([
        [
          node('engagement'),
          relation('out', '', 'product', { active: true, createdAt }),
          node('node'),
        ],
        ...this.permission('product', 'engagement', true),
      ]);
    }

    if (input.produces) {
      query.create([
        [
          node('pr'),
          relation('in', '', 'produces', {
            active: true,
            createdAt,
          }),
          node('node'),
        ],
        ...this.permission('produces', 'node', true),
      ]);
    }

    if (!input.produces && input.scriptureReferences) {
      for (const sr of input.scriptureReferences) {
        const verseRange = scriptureToVerseRange(sr);
        query
          .create([
            node('node'),
            relation('out', '', 'scriptureReferences', { active: true }),
            node('sr', 'ScriptureRange', {
              start: verseRange.start,
              end: verseRange.end,
              active: true,
              createdAt: DateTime.local().toString(),
            }),
          ])
          .create([...this.permission('scriptureReferences', 'node')]);
      }
    }

    if (input.produces && input.scriptureReferencesOverride) {
      for (const sr of input.scriptureReferencesOverride) {
        const verseRange = scriptureToVerseRange(sr);
        query
          .create([
            node('node'),
            relation('out', '', 'scriptureReferencesOverride', {
              active: true,
            }),
            node('sr', 'ScriptureRange', {
              start: verseRange.start,
              end: verseRange.end,
              active: true,
              createdAt: DateTime.local().toString(),
            }),
          ])
          .create([...this.permission('scriptureReferencesOverride', 'node')]);
      }
    }

    const result = await query.return('node.id as id').first();

    if (!result) {
      throw new ServerException('failed to create default product');
    }

    this.logger.info(`product created`, { id: result.id });
    return this.readOne(result.id, session);
  }

  async readOne(id: string, session: ISession): Promise<AnyProduct> {
    const props = ['mediums', 'purposes', 'methodology'];
    const baseNodeMetaProps = ['id', 'createdAt'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'Product', id)
      .call(addAllSecureProperties, ...props)
      .optionalMatch([
        node('scriptureReferencesReadPerm', 'Permission', {
          property: 'scriptureReferences',
          read: true,
          active: true,
        }),
        relation('out', '', 'baseNode'),
        node('node'),
        relation('out', '', 'scriptureReferences', { active: true }),
        node('scriptureReferences', 'ScriptureRange', { active: true }),
      ])
      .where({ scriptureReferencesReadPerm: inArray(['permList'], true) })
      .optionalMatch([
        node('scriptureReferencesEditPerm', 'Permission', {
          property: 'scriptureReferences',
          edit: true,
          active: true,
        }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .where({ scriptureReferencesEditPerm: inArray(['permList'], true) })
      .optionalMatch([
        node('producesReadPerm', 'Permission', {
          property: 'produces',
          read: true,
          active: true,
        }),
        relation('out', '', 'baseNode'),
        node('node'),
        relation('out', '', 'produces', { active: true }),
        node('pr', 'Producible', { active: true }),
      ])
      .where({ producesReadPerm: inArray(['permList'], true) })
      .optionalMatch([
        node('producesEditPerm', 'Permission', {
          property: 'produces',
          edit: true,
          active: true,
        }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .where({ producesEditPerm: inArray(['permList'], true) })
      .return(
        `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithSecureObject(props)},
            canScriptureReferencesRead: scriptureReferencesReadPerm.read,
            canScriptureReferencesEdit: scriptureReferencesEditPerm.edit,
            canProducesRead: producesReadPerm.read,
            canProducesEdit: producesEditPerm.edit
          } as product
        `
      );

    const result = await query.first();
    if (!result) {
      this.logger.warning(`Could not find product`, { id });
      throw new NotFoundException('Could not find product');
    }

    const produces = await this.db
      .query()
      .match([
        node('product', 'Product', { id, active: true }),
        relation('out', 'produces', { active: true }),
        node('p', 'Producible', { active: true }),
      ])
      .return('p')
      .first();

    if (!produces) {
      const scriptureReferences = await this.listScriptureReferences(
        result.product.id,
        'Product',
        session
      );
      return {
        id: result.product.id,
        createdAt: result.product.createdAt,
        mediums: result.product.mediums,
        purposes: result.product.purposes,
        methodology: result.product.methodology,
        scriptureReferences: {
          canRead: !!result.product.canScriptureReferencesRead,
          canEdit: !!result.product.canScriptureReferencesEdit,
          value: scriptureReferences,
        },
      };
    }

    const typeName = difference(produces.p.labels, [
      'Producible',
      'BaseNode',
    ])[0];

    return {
      id: result.product.id,
      createdAt: result.product.createdAt,
      mediums: result.product.mediums,
      purposes: result.product.purposes,
      methodology: result.product.methodology,
      produces: {
        value: {
          id: produces.p.properties.id,
          createdAt: produces.p.properties.createdAt,
          __typename: (ProducibleType as any)[typeName],
        },
        canRead: !!result.product.canProducesRead,
        canEdit: !!result.product.canProducesEdit,
      },
      scriptureReferences: {
        canRead: !!result.product.canScriptureReferencesRead,
        canEdit: !!result.product.canScriptureReferencesEdit,
        value: [],
      },
      // scriptureReferencesOverride: {
      //   canRead: !!result.product.canScriptureReferencesRead,
      //   canEdit: !!result.product.canScriptureReferencesEdit,
      //   value: []
      // },
    };
  }

  async update(input: UpdateProduct, session: ISession): Promise<AnyProduct> {
    // TODO scriptureReferences, produces
    const { produces, scriptureReferences, ...rest } = input;

    const object = await this.readOne(input.id, session);

    if (produces) {
      const produce = await this.db
        .query()
        .match([node('pr', 'Producible', { id: produces, active: true })])
        .return('pr')
        .first();
      if (!produce) {
        this.logger.warning(`Could not find producible node`, { id: produces });
        throw new NotFoundException('Could not find producible node');
      }

      if (!object.scriptureReferences.value.length) {
        await this.db
          .query()
          .match([
            node('product', 'Product', { id: object.id, active: true }),
            relation('out', 'rel', 'produces', { active: true }),
            node('p', 'Producible', { active: true }),
          ])
          .setValues({
            'rel.active': false,
          })
          .return('rel')
          .first();

        await this.db
          .query()
          .match([node('product', 'Product', { id: object.id, active: true })])
          .match([node('pr', 'Producible', { id: produces, active: true })])
          .create([
            node('product'),
            relation('out', 'rel', 'produces', {
              active: true,
              createdAt: DateTime.local().toString(),
            }),
            node('pr'),
          ])
          .return('rel')
          .first();
      }
    }

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
    const secureProps = ['methodology'];
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);

    if (filter.methodology) {
      query.call(filterByString, label, 'methodology', filter.methodology);
    } else if (filter.approach) {
      query.call(
        filterBySubarray,
        label,
        'methodology',
        this.getMethodologiesByApproach(filter.approach)
      );
    } else if (filter.engagementId) {
      this.filterByEngagement(
        query,
        filter.engagementId,
        'product',
        'out',
        label
      );
    }

    const result: {
      items: Array<{
        identity: string;
        labels: string[];
        properties: Product;
      }>;
      hasMore: boolean;
      total: number;
    } = await runListQuery(query, input, secureProps.includes(input.sort));

    const items = await Promise.all(
      result.items.map((item) => {
        return this.readOne(item.properties.id, session);
      })
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async listScriptureReferences(
    id: string,
    label: string,
    session: ISession
  ): Promise<ScriptureRange[]> {
    const query = this.db
      .query()
      .match([
        node('node', label, {
          id,
          active: true,
          owningOrgId: session.owningOrgId,
        }),
        relation('out', '', 'scriptureReferences'),
        node('scriptureRanges', 'ScriptureRange', { active: true }),
      ])
      .with('collect(scriptureRanges) as items')
      .return('items');
    const result = await query.first();

    if (!result) {
      return [];
    }

    const items: ScriptureRange[] = await Promise.all(
      result.items.map(
        (item: {
          identity: string;
          labels: string;
          properties: {
            start: number;
            end: number;
            createdAt: string;
            active: boolean;
          };
        }) => {
          return verseToScriptureRange({
            start: item.properties.start,
            end: item.properties.end,
          });
        }
      )
    );

    return items;
  }

  // used to search a specific engagement's relationship to the target base node
  // for example, searching all products a engagement is a part of
  protected filterByEngagement(
    query: Query,
    engagementId: string,
    relationshipType: string,
    relationshipDirection: RelationDirection,
    label: string
  ) {
    query.match([
      node('engagement', 'Engagement', { active: true, id: engagementId }),
      relation(relationshipDirection, '', relationshipType, { active: true }),
      node('node', label, { active: true }),
    ]);
  }

  protected getMethodologiesByApproach(
    approach: ProductApproach
  ): ProductMethodology[] {
    return Object.keys(MethodologyToApproach).filter(
      (key) => MethodologyToApproach[key as ProductMethodology] === approach
    ) as ProductMethodology[];
  }
}

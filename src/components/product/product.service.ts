import {
  Injectable,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import { DuplicateException, ISession, NotFoundException } from '../../common';
import {
  addAllMetaPropertiesOfChildBaseNodes,
  ChildBaseNodeMetaProperty,
  ConfigService,
  createBaseNode,
  DatabaseService,
  filterByString,
  filterBySubarray,
  ILogger,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  Property,
  runListQuery,
} from '../../core';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  parseSecuredProperties,
  StandardReadResult,
} from '../../core/database/results';
import { Film, FilmService } from '../film';
import {
  LiteracyMaterial,
  LiteracyMaterialService,
} from '../literacy-material';
import { ScriptureRange, ScriptureRangeInput } from '../scripture';
import {
  scriptureToVerseRange,
  verseToScriptureRange,
} from '../scripture/reference';
import { Song, SongService } from '../song';
import { Story, StoryService } from '../story';
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
    private readonly film: FilmService,
    private readonly story: StoryService,
    private readonly song: SongService,
    private readonly literacyMaterial: LiteracyMaterialService,
    @Logger('product:service') private readonly logger: ILogger
  ) {}

  permission = (property: string, nodeName: string, canEdit = false) => {
    const createdAt = DateTime.local();
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
    const createdAt = DateTime.local();
    // create product
    const mediums_set = new Set(input.mediums);
    if (input.mediums?.length !== mediums_set.size) {
      throw new DuplicateException(
        'product.mediums',
        'Mediums has duplicate values'
      );
    }
    const purposes_set = new Set(input.purposes);
    if (input.purposes?.length !== purposes_set.size) {
      throw new DuplicateException(
        'product.purposes',
        'Purposes has duplicate values'
      );
    }
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
      const engagement = await this.db
        .query()
        .match([
          node('engagement', 'Engagement', { active: true, id: engagementId }),
        ])
        .return('engagement')
        .first();
      if (!engagement) {
        this.logger.warning(`Could not find engagement`, {
          id: engagementId,
        });
        throw new NotFoundException(
          'Could not find engagement',
          'product.engagementId'
        );
      }
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
        throw new NotFoundException(
          'Could not find producible node',
          'product.produces'
        );
      }
      query.match([
        node('pr', 'Producible', { id: input.produces, active: true }),
      ]);
    }

    query.call(matchRequestingUser, session).call(
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
      },
      [],
      session.userId === this.config.rootAdmin.id
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
      ]);
    }

    if (!input.produces && input.scriptureReferences) {
      for (const sr of input.scriptureReferences) {
        const verseRange = scriptureToVerseRange(sr);
        query.create([
          node('node'),
          relation('out', '', 'scriptureReferences', { active: true }),
          node('', ['ScriptureRange', 'BaseNode'], {
            start: verseRange.start,
            end: verseRange.end,
            active: true,
            createdAt: DateTime.local(),
          }),
        ]);
      }
    }

    if (input.produces && input.scriptureReferencesOverride) {
      for (const sr of input.scriptureReferencesOverride) {
        const verseRange = scriptureToVerseRange(sr);
        query.create([
          node('node'),
          relation('out', '', 'scriptureReferencesOverride', {
            active: true,
          }),
          node('sr', ['ScriptureRange', 'BaseNode'], {
            start: verseRange.start,
            end: verseRange.end,
            active: true,
            createdAt: DateTime.local(),
          }),
        ]);
      }
    }

    query.create([
      ...this.permission('scriptureReferences', 'node'),
      ...this.permission('scriptureReferencesOverride', 'node'),
      ...this.permission('produces', 'node'),
    ]);

    const result = await query.return('node.id as id').first();

    if (!result) {
      throw new ServerException('failed to create default product');
    }

    this.logger.info(`product created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: string, session: ISession): Promise<AnyProduct> {
    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'scriptureReferences',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'ScriptureRange',
        childBaseNodeMetaPropertyKey: '',
        returnIdentifier: '',
      },
      {
        parentBaseNodePropertyKey: 'scriptureReferencesOverride',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'ScriptureRange',
        childBaseNodeMetaPropertyKey: '',
        returnIdentifier: '',
      },
      {
        parentBaseNodePropertyKey: 'produces',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'Producible',
        childBaseNodeMetaPropertyKey: '',
        returnIdentifier: '',
      },
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Product', { active: true, id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member*1..'),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission'),
        node('perms', 'Permission', { active: true }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property', { active: true }),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with(['collect(prop) as propList', 'permList', 'node'])
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      .return([
        'propList, permList, node',
        'scriptureReferencesReadPerm.read as canScriptureReferencesRead',
        'scriptureReferencesEditPerm.edit as canScriptureReferencesEdit',
        'scriptureReferencesOverrideReadPerm.read as canScriptureReferencesOverrideRead',
        'scriptureReferencesOverrideEditPerm.edit as canScriptureReferencesOverrideEdit',
        'producesReadPerm.read as canProducesRead',
        'producesEditPerm.edit as canProducesEdit',
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<AnyProduct>> & {
          canScriptureReferencesRead: boolean;
          canScriptureReferencesEdit: boolean;
          canScriptureReferencesOverrideRead: boolean;
          canScriptureReferencesOverrideEdit: boolean;
          canProducesRead: boolean;
          canProducesEdit: boolean;
        }
      >();
    const result = await query.first();

    if (!result) {
      this.logger.warning(`Could not find product`, { id });
      throw new NotFoundException('Could not find product', 'product.id');
    }

    const props = parsePropList(result.propList);
    const securedProperties = parseSecuredProperties(props, result.permList, {
      mediums: true,
      purposes: true,
      methodology: true,
    });
    const baseNodeProps = parseBaseNodeProperties(result.node);

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
        baseNodeProps.id,
        'Product',
        session
      );
      return {
        ...baseNodeProps,
        ...securedProperties,
        scriptureReferences: {
          canRead: result.canScriptureReferencesRead,
          canEdit: result.canScriptureReferencesEdit,
          value: scriptureReferences,
        },
        mediums: {
          ...securedProperties.mediums,
          value: securedProperties.mediums.value ?? [],
        },
        purposes: {
          ...securedProperties.purposes,
          value: securedProperties.purposes.value ?? [],
        },
      };
    }

    const scriptureReferencesOverride = await this.listScriptureReferences(
      baseNodeProps.id,
      'Product',
      session,
      { isOverride: true }
    );

    const typeName = difference(produces.p.labels, [
      'Producible',
      'BaseNode',
    ])[0];

    const producible = await this.getProducibleByType(
      produces.p.properties.id,
      typeName,
      session
    );

    return {
      ...baseNodeProps,
      ...securedProperties,
      scriptureReferences: {
        canRead: result.canScriptureReferencesRead,
        canEdit: result.canScriptureReferencesEdit,
        value: [],
      },
      mediums: {
        ...securedProperties.mediums,
        value: securedProperties.mediums.value ?? [],
      },
      purposes: {
        ...securedProperties.purposes,
        value: securedProperties.purposes.value ?? [],
      },
      produces: {
        value: {
          id: produces.p.properties.id,
          createdAt: produces.p.properties.createdAt,
          __typename: (ProducibleType as any)[typeName],
          scriptureReferences: !scriptureReferencesOverride.length
            ? producible?.scriptureReferences
            : {
                canRead: result.canScriptureReferencesOverrideRead,
                canEdit: result.canScriptureReferencesOverrideEdit,
                value: scriptureReferencesOverride,
              },
          ...producible,
        },
        canRead: result.canProducesRead,
        canEdit: result.canProducesEdit,
      },
      scriptureReferencesOverride: {
        canRead: result.canScriptureReferencesOverrideRead,
        canEdit: result.canScriptureReferencesOverrideEdit,
        value: !scriptureReferencesOverride.length
          ? null
          : scriptureReferencesOverride,
      },
    };
  }

  async update(input: UpdateProduct, session: ISession): Promise<AnyProduct> {
    const {
      produces,
      scriptureReferences,
      scriptureReferencesOverride,
      ...rest
    } = input;

    if (produces) {
      const produce = await this.db
        .query()
        .match([node('pr', 'Producible', { id: produces, active: true })])
        .return('pr')
        .first();
      if (!produce) {
        this.logger.warning(`Could not find producible node`, { id: produces });
        throw new NotFoundException(
          'Could not find producible node',
          'product.produces'
        );
      }
      await this.db
        .query()
        .match([
          node('product', 'Product', { id: input.id, active: true }),
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
        .match([node('product', 'Product', { id: input.id, active: true })])
        .match([node('pr', 'Producible', { id: produces, active: true })])
        .create([
          node('product'),
          relation('out', 'rel', 'produces', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('pr'),
        ])
        .return('rel')
        .first();
    }

    if (!produces && scriptureReferences) {
      await this.updateScriptureReferences(input.id, scriptureReferences);
    }

    if (scriptureReferencesOverride) {
      await this.updateScriptureReferences(
        input.id,
        scriptureReferencesOverride,
        true
      );
    }

    const object = await this.readOne(input.id, session);

    return await this.db.updateProperties({
      session,
      object,
      props: ['mediums', 'purposes', 'methodology'],
      changes: rest,
      nodevar: 'product',
    });
  }

  protected async updateScriptureReferences(
    productId: string,
    scriptureReferences: ScriptureRangeInput[],
    isOverride?: boolean
  ): Promise<void> {
    const rel = !isOverride
      ? 'scriptureReferences'
      : 'scriptureReferencesOverride';
    await this.db
      .query()
      .match([
        node('product', 'Product', { id: productId, active: true }),
        relation('out', 'rel', rel, { active: true }),
        node('sr', 'ScriptureRange', { active: true }),
      ])
      .setValues({
        'rel.active': false,
        'sr.active': false,
      })
      .return('sr')
      .first();

    for (const sr of scriptureReferences) {
      const verseRange = scriptureToVerseRange(sr);
      await this.db
        .query()
        .match([node('product', 'Product', { id: productId, active: true })])
        .create([
          node('product'),
          relation('out', '', rel, { active: true }),
          node('', ['ScriptureRange', 'BaseNode'], {
            start: verseRange.start,
            end: verseRange.end,
            active: true,
            createdAt: DateTime.local(),
          }),
        ])
        .return('product')
        .first();
    }
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find product', 'product.id');
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

  protected async listScriptureReferences(
    id: string,
    label: string,
    session: ISession,
    options: { isOverride?: boolean } = {}
  ): Promise<ScriptureRange[]> {
    const query = this.db
      .query()
      .match([
        node('node', label, {
          id,
          active: true,
          owningOrgId: session.owningOrgId,
        }),
        relation(
          'out',
          '',
          options.isOverride
            ? 'scriptureReferencesOverride'
            : 'scriptureReferences',
          {
            active: true,
          }
        ),
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

  protected async getProducibleByType(
    id: string,
    type: string,
    session: ISession
  ): Promise<Film | Story | Song | LiteracyMaterial | undefined> {
    if (type === 'Film') {
      return await this.film.readOne(id, session);
    } else if (type === 'Story') {
      return await this.story.readOne(id, session);
    } else if (type === 'Song') {
      return await this.song.readOne(id, session);
    } else if (type === 'LiteracyMaterial') {
      return await this.literacyMaterial.readOne(id, session);
    }

    return undefined;
  }
}

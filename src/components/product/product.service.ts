import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import type { Node } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ISession,
  NotFoundException,
  ServerException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  getPermList,
  getPropList,
  ILogger,
  Logger,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import type { BaseNode } from '../../core/database/results';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  runListQuery,
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
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  MethodologyToApproach,
  ProducibleType,
  ProductApproach,
  ProductListInput,
  ProductListOutput,
  ProductMethodology,
  UpdateProduct,
} from './dto';

@Injectable()
export class ProductService {
  private readonly securedProperties = {
    mediums: true,
    purposes: true,
    methodology: true,
  };

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

    this.logger.debug(`product created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: string, session: ISession): Promise<AnyProduct> {
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Product', { active: true, id })])
      .call(getPermList, 'requestingUser')
      .call(getPropList, 'permList')
      .return(['propList, permList, node'])
      .asResult<
        StandardReadResult<
          DbPropsOfDto<DirectScriptureProduct & DerivativeScriptureProduct>
        >
      >();
    const result = await query.first();

    if (!result) {
      this.logger.warning(`Could not find product`, { id });
      throw new NotFoundException('Could not find product', 'product.id');
    }

    const {
      produces,
      scriptureReferencesOverride,
      ...rest
    } = parseSecuredProperties(result.propList, result.permList, {
      mediums: true,
      purposes: true,
      methodology: true,
      scriptureReferences: true,
      scriptureReferencesOverride: true,
      produces: true,
    });

    const pr = await this.db
      .query()
      .match([
        node('product', 'Product', { id, active: true }),
        relation('out', 'produces', { active: true }),
        node('p', 'Producible', { active: true }),
      ])
      .return('p')
      .asResult<{ p: Node<BaseNode> }>()
      .first();

    const scriptureReferencesValue = await this.listScriptureReferences(
      id,
      'Product',
      session,
      { isOverride: pr ? true : false }
    );

    if (!pr) {
      return {
        ...parseBaseNodeProperties(result.node),
        ...rest,
        scriptureReferences: {
          ...rest.scriptureReferences,
          value: scriptureReferencesValue,
        },
        mediums: {
          ...rest.mediums,
          value: rest.mediums.value ?? [],
        },
        purposes: {
          ...rest.purposes,
          value: rest.purposes.value ?? [],
        },
      };
    }

    const typeName = difference(pr.p.labels, ['Producible', 'BaseNode'])[0];

    const producible = await this.getProducibleByType(
      pr.p.properties.id,
      typeName,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...rest,
      scriptureReferences: {
        ...rest.scriptureReferences,
        value: !scriptureReferencesValue.length
          ? producible?.scriptureReferences.value
            ? producible?.scriptureReferences.value
            : []
          : scriptureReferencesValue,
      },
      mediums: {
        ...rest.mediums,
        value: rest.mediums.value ?? [],
      },
      purposes: {
        ...rest.purposes,
        value: rest.purposes.value ?? [],
      },
      produces: {
        ...produces,
        value: {
          ...producible,
          id: pr.p.properties.id,
          __typename: (ProducibleType as any)[typeName],
          scriptureReferences: !scriptureReferencesValue.length
            ? producible?.scriptureReferences
            : {
                ...scriptureReferencesOverride,
                value: scriptureReferencesValue,
              },
        },
      },
      scriptureReferencesOverride: {
        ...scriptureReferencesOverride,
        value: !scriptureReferencesValue.length
          ? null
          : scriptureReferencesValue,
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
    } catch (exception) {
      this.logger.warning('Failed to delete product', {
        exception,
      });
      throw new ServerException('Failed to delete product', exception);
    }
  }

  async list(
    { filter, ...input }: ProductListInput,
    session: ISession
  ): Promise<ProductListOutput> {
    const label = 'Product';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.engagementId
          ? [
              relation('in', '', 'product', { active: true }),
              node('engagement', 'Engagement', {
                active: true,
                id: filter.engagementId,
              }),
            ]
          : []),
      ])
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property', { active: true }),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
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

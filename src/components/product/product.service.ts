import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import type { Node } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import { Except } from 'type-fest';
import {
  generateId,
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  BaseNode,
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { Role, rolesForScope } from '../authorization';
import { AuthorizationService } from '../authorization/authorization.service';
import { Film, FilmService } from '../film';
import {
  LiteracyMaterial,
  LiteracyMaterialService,
} from '../literacy-material';
import { ScriptureRange } from '../scripture/dto';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
import { Song, SongService } from '../song';
import { Story, StoryService } from '../story';
import {
  AnyProduct,
  CreateProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  MethodologyToApproach,
  ProducibleType,
  Product,
  ProductApproach,
  ProductListInput,
  ProductListOutput,
  ProductMethodology,
  UpdateProduct,
} from './dto';
import { DbProduct } from './model';

@Injectable()
export class ProductService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly film: FilmService,
    private readonly story: StoryService,
    private readonly song: SongService,
    private readonly literacyMaterial: LiteracyMaterialService,
    private readonly scriptureRefService: ScriptureReferenceService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    @Logger('product:service') private readonly logger: ILogger
  ) {}

  async create(
    { engagementId, ...input }: CreateProduct,
    session: Session
  ): Promise<AnyProduct> {
    const createdAt = DateTime.local();
    const secureProps: Property[] = [
      {
        key: 'mediums',
        value: input.mediums,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProductMedium',
      },
      {
        key: 'purposes',
        value: input.purposes,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProductPurpose',
      },
      {
        key: 'methodology',
        value: input.methodology,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProductMethodology',
      },
      {
        key: 'isOverriding',
        value: false,
        isPublic: false,
        isOrgPublic: false,
        label: '',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    const query = this.db.query();

    if (engagementId) {
      const engagement = await this.db
        .query()
        .match([node('engagement', 'Engagement', { id: engagementId })])
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
      query.match([node('engagement', 'Engagement', { id: engagementId })]);
    }

    if (input.produces) {
      const producible = await this.db
        .query()
        .match([
          node('producible', 'Producible', {
            id: input.produces,
          }),
        ])
        .return('producible')
        .first();
      if (!producible) {
        this.logger.warning(`Could not find producible node`, {
          id: input.produces,
        });
        throw new NotFoundException(
          'Could not find producible node',
          'product.produces'
        );
      }
      query.match([node('producible', 'Producible', { id: input.produces })]);
      if (input.scriptureReferencesOverride) {
        secureProps[3].value = true;
      }
    }

    query
      .call(matchRequestingUser, session)
      .call(
        createBaseNode,
        await generateId(),
        [
          'Product',
          input.produces
            ? 'DerivativeScriptureProduct'
            : 'DirectScriptureProduct',
        ],
        secureProps
      );

    if (engagementId) {
      query.create([
        [
          node('engagement'),
          relation('out', '', 'product', { active: true, createdAt }),
          node('node'),
        ],
      ]);
    }

    if (input.produces) {
      query.create([
        [
          node('producible'),
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
        query.create([
          node('node'),
          relation('out', '', 'scriptureReferences', { active: true }),
          node('', ['ScriptureRange', 'BaseNode'], {
            ...ScriptureRange.fromReferences(sr),

            createdAt: DateTime.local(),
          }),
        ]);
      }
    }

    if (input.produces && input.scriptureReferencesOverride) {
      for (const sr of input.scriptureReferencesOverride) {
        query.create([
          node('node'),
          relation('out', '', 'scriptureReferencesOverride', {
            active: true,
          }),
          node('', ['ScriptureRange', 'BaseNode'], {
            ...ScriptureRange.fromReferences(sr),

            createdAt: DateTime.local(),
          }),
        ]);
      }
    }

    const result = await query.return('node.id as id').first();

    if (!result) {
      throw new ServerException('failed to create default product');
    }

    const dbProduct = new DbProduct();
    await this.authorizationService.processNewBaseNode(
      dbProduct,
      result.id,
      session.userId
    );

    this.logger.debug(`product created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOne(id: ID, session: Session): Promise<AnyProduct> {
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Product', { id })])
      .call(matchPropList)
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'Engagement'),
        relation('out', '', 'product', { active: true }),
        node('', 'Product', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .call(matchMemberRoles, session.userId)
      .return(['propList, node, memberRoles'])
      .asResult<
        StandardReadResult<
          DbPropsOfDto<
            DirectScriptureProduct &
              DerivativeScriptureProduct & {
                isOverriding: boolean;
              }
          >
        > & {
          memberRoles: Role[][];
        }
      >();
    const result = await query.first();

    if (!result) {
      this.logger.warning(`Could not find product`, { id });
      throw new NotFoundException('Could not find product', 'product.id');
    }

    const { isOverriding, ...props } = parsePropList(result.propList);
    const {
      produces,
      scriptureReferencesOverride,
      ...rest
    } = await this.authorizationService.secureProperties(
      DerivativeScriptureProduct,
      props,
      session,
      result.memberRoles.flat().map(rolesForScope('project'))
    );

    const connectedProducible = await this.db
      .query()
      .match([
        node('product', 'Product', { id }),
        relation('out', 'produces', { active: true }),
        node('producible', 'Producible'),
      ])
      .return('producible')
      .asResult<{ producible: Node<BaseNode> }>()
      .first();

    const scriptureReferencesValue = await this.scriptureRefService.list(
      id,
      session,
      { isOverriding: connectedProducible ? true : false }
    );

    if (!connectedProducible) {
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
        canDelete: await this.db.checkDeletePermission(id, session),
      };
    }

    const typeName = (difference(connectedProducible.producible.labels, [
      'Producible',
      'BaseNode',
    ]) as ProducibleType[])[0];

    const producible = await this.getProducibleByType(
      connectedProducible.producible.properties.id,
      typeName,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...rest,
      scriptureReferences: {
        ...rest.scriptureReferences,
        value: !isOverriding
          ? producible?.scriptureReferences.value
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
          __typename: typeName,
        },
      },
      scriptureReferencesOverride: {
        ...scriptureReferencesOverride,
        value: !isOverriding ? null : scriptureReferencesValue,
      },
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateProduct, session: Session): Promise<AnyProduct> {
    const currentProduct = await this.readOne(input.id, session);
    const isDirectScriptureProduct = !currentProduct.produces;

    if (isDirectScriptureProduct) {
      if (input.produces) {
        throw new InputException(
          'Cannot update produces on a Direct Scripture Product',
          'product.produces'
        );
      }
      //If current product is a Direct Scripture Product, cannot update scriptureReferencesOverride or produces
      if (input.scriptureReferencesOverride) {
        throw new InputException(
          'Cannot update Scripture References Override on a Direct Scripture Product',
          'product.scriptureReferencesOverride'
        );
      }
      return await this.updateDirect(currentProduct, input, session);
    }

    // If current product is a Derivative Scripture Product, cannot update scriptureReferencesOverride
    if (input.scriptureReferences) {
      throw new InputException(
        'Cannot update Scripture References on a Derivative Scripture Product',
        'product.scriptureReferences'
      );
    }
    return await this.updateDerivative(
      currentProduct as DerivativeScriptureProduct,
      input,
      session
    );
  }

  private async updateDirect(
    currentProduct: DirectScriptureProduct,
    input: Except<UpdateProduct, 'produces' | 'scriptureReferencesOverride'>,
    session: Session
  ) {
    const changes = this.db.getActualChanges(
      DirectScriptureProduct,
      currentProduct,
      input
    );
    await this.authorizationService.verifyCanEditChanges(
      Product,
      currentProduct,
      changes,
      'product'
    );
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);

    const productUpdatedScriptureReferences = await this.readOne(
      input.id,
      session
    );

    return await this.db.updateProperties({
      type: DirectScriptureProduct,
      object: productUpdatedScriptureReferences,
      changes: simpleChanges,
    });
  }

  private async updateDerivative(
    currentProduct: DerivativeScriptureProduct,
    input: Except<UpdateProduct, 'scriptureReferences'>,
    session: Session
  ) {
    let changes = this.db.getActualChanges(
      DerivativeScriptureProduct,
      currentProduct,
      input
    );
    changes = {
      ...changes,
      // This needs to be manually checked for changes as the existing value
      // is the object not the ID.
      produces:
        currentProduct.produces.value !== input.produces
          ? input.produces
          : undefined,
    };

    await this.authorizationService.verifyCanEditChanges(
      Product,
      currentProduct,
      changes,
      'product'
    );

    const { produces, scriptureReferencesOverride, ...simpleChanges } = changes;

    // If given an new produces id, update the producible
    if (produces) {
      const producible = await this.db
        .query()
        .match([
          node('producible', 'Producible', {
            id: produces,
          }),
        ])
        .return('producible')
        .first();
      if (!producible) {
        this.logger.warning(`Could not find producible node`, {
          id: produces,
        });
        throw new NotFoundException(
          'Could not find producible node',
          'product.produces'
        );
      }
      await this.db
        .query()
        .match([
          node('product', 'Product', { id: input.id }),
          relation('out', 'rel', 'produces', { active: true }),
          node('', 'Producible'),
        ])
        .setValues({
          'rel.active': false,
        })
        .return('rel')
        .first();

      await this.db
        .query()
        .match([node('product', 'Product', { id: input.id })])
        .match([
          node('producible', 'Producible', {
            id: produces,
          }),
        ])
        .create([
          node('product'),
          relation('out', 'rel', 'produces', {
            active: true,
            createdAt: DateTime.local(),
          }),
          node('producible'),
        ])
        .return('rel')
        .first();
    }

    // update the scripture references (override)
    await this.scriptureRefService.update(
      input.id,
      scriptureReferencesOverride,
      { isOverriding: true }
    );

    const productUpdatedScriptureReferences = await this.readOne(
      input.id,
      session
    );

    return await this.db.updateProperties({
      type: DerivativeScriptureProduct,
      object: productUpdatedScriptureReferences,
      changes: simpleChanges,
    });
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find product', 'product.id');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Product'
      );

    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    { filter, ...input }: ProductListInput,
    session: Session
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
                id: filter.engagementId,
              }),
            ]
          : []),
      ])
      .call(calculateTotalAndPaginateList(Product, input));

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  // used to search a specific engagement's relationship to the target base node
  // for example, searching all products a engagement is a part of
  protected filterByEngagement(
    query: Query,
    engagementId: ID,
    relationshipType: string,
    relationshipDirection: RelationDirection,
    label: string
  ) {
    query.match([
      node('engagement', 'Engagement', { id: engagementId }),
      relation(relationshipDirection, '', relationshipType, { active: true }),
      node('node', label),
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
    id: ID,
    type: string,
    session: Session
  ): Promise<Film | Story | Song | LiteracyMaterial> {
    if (type === 'Film') {
      return await this.film.readOne(id, session);
    } else if (type === 'Story') {
      return await this.story.readOne(id, session);
    } else if (type === 'Song') {
      return await this.song.readOne(id, session);
    } else {
      return await this.literacyMaterial.readOne(id, session);
    }
  }
}

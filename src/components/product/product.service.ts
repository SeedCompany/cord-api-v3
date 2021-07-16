import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { difference } from 'lodash';
import { Except } from 'type-fest';
import {
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { Film, FilmService } from '../film';
import {
  LiteracyMaterial,
  LiteracyMaterialService,
} from '../literacy-material';
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
import { ProductRepository } from './product.repository';

@Injectable()
export class ProductService {
  constructor(
    private readonly film: FilmService,
    private readonly story: StoryService,
    private readonly song: SongService,
    private readonly literacyMaterial: LiteracyMaterialService,
    private readonly scriptureRefService: ScriptureReferenceService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: ProductRepository,
    @Logger('product:service') private readonly logger: ILogger
  ) {}

  async create(input: CreateProduct, session: Session): Promise<AnyProduct> {
    const engagement = await this.repo.findNode(
      'engagement',
      input.engagementId
    );
    if (!engagement) {
      this.logger.warning(`Could not find engagement`, {
        id: input.engagementId,
      });
      throw new NotFoundException(
        'Could not find engagement',
        'product.engagementId'
      );
    }

    if (input.produces) {
      const producible = await this.repo.findNode('producible', input.produces);
      if (!producible) {
        this.logger.warning(`Could not find producible node`, {
          id: input.produces,
        });
        throw new NotFoundException(
          'Could not find producible node',
          'product.produces'
        );
      }
    }

    const id = await this.repo.create(input);

    await this.authorizationService.processNewBaseNode(
      Product,
      id,
      session.userId
    );

    this.logger.debug(`product created`, { id });
    return await this.readOne(id, session);
  }

  @HandleIdLookup([DirectScriptureProduct, DerivativeScriptureProduct])
  async readOne(id: ID, session: Session): Promise<AnyProduct> {
    const result = await this.repo.readOne(id, session);

    if (!result) {
      this.logger.warning(`Could not find product`, { id });
      throw new NotFoundException('Could not find product', 'product.id');
    }

    const { isOverriding, ...props } = result.props;
    const { produces, scriptureReferencesOverride, ...rest } =
      await this.authorizationService.secureProperties(
        DerivativeScriptureProduct,
        props,
        session,
        result.scopedRoles
      );

    const connectedProducible = await this.repo.connectedProducible(id);

    const scriptureReferencesValue = await this.scriptureRefService.list(
      id,
      session,
      { isOverriding: connectedProducible ? true : false }
    );

    if (!connectedProducible) {
      return {
        id: props.id,
        createdAt: props.createdAt,
        ...rest,
        sensitivity: props.sensitivity,
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
        canDelete: await this.repo.checkDeletePermission(id, session),
      };
    }

    const typeName = (
      difference(connectedProducible.producible.labels, [
        'Producible',
        'BaseNode',
      ]) as ProducibleType[]
    )[0];

    const producible = await this.getProducibleByType(
      connectedProducible.producible.properties.id,
      typeName,
      session
    );

    return {
      id: props.id,
      createdAt: props.createdAt,
      ...rest,
      sensitivity: props.sensitivity,
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
      canDelete: await this.repo.checkDeletePermission(id, session),
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
    const changes = this.repo.getActualDirectChanges(currentProduct, input);
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

    return await this.repo.updateProperties(
      productUpdatedScriptureReferences,
      simpleChanges
    );
  }

  private async updateDerivative(
    currentProduct: DerivativeScriptureProduct,
    input: Except<UpdateProduct, 'scriptureReferences'>,
    session: Session
  ) {
    let changes = this.repo.getActualDerivativeChanges(currentProduct, input);
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
      const producible = await this.repo.findProducible(produces);

      if (!producible) {
        this.logger.warning(`Could not find producible node`, {
          id: produces,
        });
        throw new NotFoundException(
          'Could not find producible node',
          'product.produces'
        );
      }
      await this.repo.updateProducible(input, produces);
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

    return await this.repo.updateDerivativeProperties(
      productUpdatedScriptureReferences,
      simpleChanges
    );
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find product', 'product.id');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Product'
      );

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: ProductListInput,
    session: Session
  ): Promise<ProductListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (id) => this.readOne(id, session));
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

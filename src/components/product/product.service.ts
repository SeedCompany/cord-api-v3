import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Except } from 'type-fest';
import {
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger, ResourceResolver } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
import {
  AnyProduct,
  CreateProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  MethodologyToApproach,
  ProducibleResult,
  Product,
  ProductApproach,
  ProductCompletionDescriptionSuggestionsInput,
  ProductListInput,
  ProductListOutput,
  ProductMethodology,
  UpdateProduct,
} from './dto';
import { ProductRepository } from './product.repository';

@Injectable()
export class ProductService {
  constructor(
    private readonly scriptureRefService: ScriptureReferenceService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: ProductRepository,
    private readonly resources: ResourceResolver,
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
    const dto = await this.readOneUnsecured(id, session);
    return await this.secure(dto, session);
  }

  async readOneUnsecured(
    id: ID,
    session: Session
  ): Promise<UnsecuredDto<AnyProduct>> {
    const { isOverriding, produces, ...props } = await this.repo.readOne(
      id,
      session
    );

    const producible = produces
      ? ((await this.resources.lookupByBaseNode(
          produces,
          session
        )) as unknown as ProducibleResult)
      : undefined;

    const scriptureReferencesValue = await this.scriptureRefService.list(
      id,
      session,
      { isOverriding: !!producible }
    );

    if (!producible) {
      return {
        ...props,
        scriptureReferences: scriptureReferencesValue,
      };
    }
    return {
      ...props,
      produces: producible,
      scriptureReferences: !isOverriding
        ? producible.scriptureReferences.value
        : scriptureReferencesValue,
      scriptureReferencesOverride: !isOverriding
        ? null
        : scriptureReferencesValue,
    };
  }

  async secure(
    dto: UnsecuredDto<AnyProduct>,
    session: Session
  ): Promise<AnyProduct> {
    const canDelete = await this.repo.checkDeletePermission(dto.id, session);

    if (dto.produces) {
      const securedProps = await this.authorizationService.secureProperties(
        DerivativeScriptureProduct,
        dto,
        session,
        dto.scope
      );
      return {
        ...dto,
        ...securedProps,
        mediums: {
          ...securedProps.mediums,
          value: securedProps.mediums.value ?? [],
        },
        purposes: {
          ...securedProps.purposes,
          value: securedProps.purposes.value ?? [],
        },
        canDelete,
      };
    }

    const securedProps = await this.authorizationService.secureProperties(
      DirectScriptureProduct,
      dto,
      session,
      dto.scope
    );
    return {
      ...dto,
      ...securedProps,
      mediums: {
        ...securedProps.mediums,
        value: securedProps.mediums.value ?? [],
      },
      purposes: {
        ...securedProps.purposes,
        value: securedProps.purposes.value ?? [],
      },
      canDelete,
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

    if (changes.describeCompletion || changes.methodology) {
      await this.repo.mergeCompletionDescription(
        changes.describeCompletion ?? currentProduct.describeCompletion.value!,
        changes.methodology ?? currentProduct.methodology.value!
      );
    }

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

    if (changes.describeCompletion || changes.methodology) {
      await this.repo.mergeCompletionDescription(
        changes.describeCompletion ?? currentProduct.describeCompletion.value!,
        changes.methodology ?? currentProduct.methodology.value!
      );
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

  protected getMethodologiesByApproach(
    approach: ProductApproach
  ): ProductMethodology[] {
    return Object.keys(MethodologyToApproach).filter(
      (key) => MethodologyToApproach[key as ProductMethodology] === approach
    ) as ProductMethodology[];
  }

  async suggestCompletionDescriptions(
    input: ProductCompletionDescriptionSuggestionsInput
  ) {
    return await this.repo.suggestCompletionDescriptions(input);
  }
}

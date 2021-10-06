import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { Except } from 'type-fest';
import {
  has,
  ID,
  InputException,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  simpleSwitch,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger, ResourceResolver } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
import {
  AnyProduct,
  CreateOtherProduct,
  CreateProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  MethodologyToApproach,
  OtherProduct,
  ProducibleResult,
  Product,
  ProductApproach,
  ProductCompletionDescriptionSuggestionsInput,
  ProductListInput,
  ProductListOutput,
  ProductMethodology,
  UpdateOtherProduct,
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

  async create(
    input: CreateProduct | CreateOtherProduct,
    session: Session
  ): Promise<AnyProduct> {
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

    if (has('produces', input) && input.produces) {
      const producible = await this.repo.findNode(
        'producible',
        input.produces as ID
      );
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

    const progressTarget = simpleSwitch(input.progressStepMeasurement, {
      Percent: 100,
      Boolean: 1,
      Number: input.progressTarget ?? 1,
    });
    const id = has('title', input)
      ? await this.repo.createOther({ ...input, progressTarget })
      : await this.repo.create({ ...input, progressTarget });

    await this.authorizationService.processNewBaseNode(
      Product,
      id,
      session.userId
    );

    this.logger.debug(`product created`, { id });
    return await this.readOne(id, session);
  }

  @HandleIdLookup([
    DirectScriptureProduct,
    DerivativeScriptureProduct,
    OtherProduct,
  ])
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<AnyProduct> {
    const dto = await this.readOneUnsecured(id, session);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const products = await this.repo.readMany(ids, session);
    return await Promise.all(
      products.map(async (dto) => await this.readOne(dto.id, session))
    );
  }

  async readOneUnsecured(
    id: ID,
    session: Session
  ): Promise<UnsecuredDto<AnyProduct>> {
    const { isOverriding, produces, title, description, ...props } =
      await this.repo.readOne(id, session);

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

    if (title) {
      return {
        ...props,
        title,
        description,
        scriptureReferences: scriptureReferencesValue,
      };
    }

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
        session
      );
      const derivative: DerivativeScriptureProduct = {
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
        steps: {
          ...securedProps.steps,
          value: securedProps.steps.value ?? [],
        },
        canDelete,
      };
      return derivative;
    }

    if (dto.title) {
      const securedProps = await this.authorizationService.secureProperties(
        OtherProduct,
        dto,
        session
      );
      const other: OtherProduct = {
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
        steps: {
          ...securedProps.steps,
          value: securedProps.steps.value ?? [],
        },
        canDelete,
      };
      return other;
    }

    const securedProps = await this.authorizationService.secureProperties(
      DirectScriptureProduct,
      dto,
      session
    );
    const direct: DirectScriptureProduct = {
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
      steps: {
        ...securedProps.steps,
        value: securedProps.steps.value ?? [],
      },
      canDelete,
    };
    return direct;
  }

  async update(input: UpdateProduct, session: Session): Promise<AnyProduct> {
    const currentProduct = await this.readOneUnsecured(input.id, session);

    // If isDirectScriptureProduct
    if (!currentProduct.produces) {
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
    return await this.updateDerivative(currentProduct, input, session);
  }

  private async updateDirect(
    currentProduct: UnsecuredDto<DirectScriptureProduct>,
    input: Except<UpdateProduct, 'produces' | 'scriptureReferencesOverride'>,
    session: Session
  ) {
    let changes = this.repo.getActualDirectChanges(currentProduct, input);
    changes = {
      ...changes,
      progressTarget: this.restrictProgressTargetChange(
        currentProduct,
        input,
        changes
      ),
    };

    await this.authorizationService.verifyCanEditChanges(
      Product,
      await this.secure(currentProduct, session),
      changes,
      'product'
    );
    const { scriptureReferences, ...simpleChanges } = changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);

    await this.mergeCompletionDescription(changes, currentProduct);

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
    currentProduct: UnsecuredDto<DerivativeScriptureProduct>,
    input: Except<UpdateProduct, 'scriptureReferences'>,
    session: Session
  ) {
    let changes = this.repo.getActualDerivativeChanges(
      // getChanges doesn't care if current is secured or not.
      // Applying this type so that the SetChangeType<> overrides still apply
      currentProduct as unknown as DerivativeScriptureProduct,
      input
    );
    changes = {
      ...changes,
      // This needs to be manually checked for changes as the existing value
      // is the object not the ID.
      produces:
        currentProduct.produces.id !== input.produces
          ? input.produces
          : undefined,
      progressTarget: this.restrictProgressTargetChange(
        currentProduct,
        input,
        changes
      ),
    };

    await this.authorizationService.verifyCanEditChanges(
      Product,
      await this.secure(currentProduct, session),
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

    await this.mergeCompletionDescription(changes, currentProduct);

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

  async updateOther(input: UpdateOtherProduct, session: Session) {
    const currentProduct = await this.readOneUnsecured(input.id, session);
    if (!currentProduct.title) {
      throw new InputException('Product given is not an OtherProduct');
    }

    let changes = this.repo.getActualOtherChanges(currentProduct, input);
    changes = {
      ...changes,
      progressTarget: this.restrictProgressTargetChange(
        currentProduct,
        input,
        changes
      ),
    };

    await this.authorizationService.verifyCanEditChanges(
      Product,
      await this.secure(currentProduct, session),
      changes,
      null
    );

    await this.mergeCompletionDescription(changes, currentProduct);

    const currentSecured = (await this.secure(
      currentProduct,
      session
    )) as OtherProduct;
    return await this.repo.updateOther(currentSecured, changes);
  }

  /**
   * Restrict progressTarget changes based on measurement restrictions
   */
  private restrictProgressTargetChange(
    currentProduct: Pick<UpdateProduct, 'progressStepMeasurement'>,
    input: Pick<UpdateProduct, 'progressTarget' | 'progressStepMeasurement'>,
    changes: Pick<UpdateProduct, 'progressTarget' | 'progressStepMeasurement'>
  ) {
    return simpleSwitch(
      input.progressStepMeasurement ?? currentProduct.progressStepMeasurement,
      {
        Number: changes.progressStepMeasurement
          ? // If measurement is being changed to number,
            // accept new target value or default to 1 (as done in create).
            changes.progressTarget ?? 1
          : // If measurement was already number,
            // accept new target value if given or accept no change.
            changes.progressTarget,
        // If measurement is changing to percent or boolean, change target
        // to its enforced value, otherwise don't allow any changes.
        Percent: changes.progressStepMeasurement ? 100 : undefined,
        Boolean: changes.progressStepMeasurement ? 1 : undefined,
      }
    );
  }

  private async mergeCompletionDescription(
    changes: Partial<Pick<UpdateProduct, 'describeCompletion' | 'methodology'>>,
    currentProduct: UnsecuredDto<Product>
  ) {
    if (
      changes.describeCompletion === undefined &&
      changes.methodology === undefined
    ) {
      // no changes, do nothing
      return;
    }
    const describeCompletion =
      changes.describeCompletion !== undefined
        ? changes.describeCompletion
        : currentProduct.describeCompletion;
    const methodology =
      changes.methodology !== undefined
        ? changes.methodology
        : currentProduct.methodology;
    if (!describeCompletion || !methodology) {
      // If either are still missing or have been set to null skip persisting.
      return;
    }
    await this.repo.mergeCompletionDescription(describeCompletion, methodology);
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

  async listIdsAndScriptureRefs(engagementId: ID) {
    return await this.repo.listIdsAndScriptureRefs(engagementId);
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

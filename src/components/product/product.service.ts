import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { intersection, isEqual, sumBy, uniq } from 'lodash';
import {
  has,
  ID,
  InputException,
  mapFromList,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  simpleSwitch,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { HandleIdLookup, ILogger, Logger, ResourceResolver } from '../../core';
import { isSame } from '../../core/database/changes';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { ScriptureRange } from '../scripture';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
import {
  getTotalVerseEquivalents,
  getTotalVerses,
  getVerseEquivalentsFromUnspecified,
} from '../scripture/verse-equivalents';
import {
  AnyProduct,
  asProductType,
  CreateDerivativeScriptureProduct,
  CreateDirectScriptureProduct,
  CreateOtherProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  getAvailableSteps,
  MethodologyToApproach,
  OtherProduct,
  ProducibleResult,
  Product,
  ProductApproach,
  ProductCompletionDescriptionSuggestionsInput,
  ProductListInput,
  ProductListOutput,
  ProductMethodology,
  UpdateDerivativeScriptureProduct,
  UpdateDirectScriptureProduct,
  UpdateOtherProduct,
  UpdateProduct,
} from './dto';
import { ProducibleType } from './dto/producible.dto';
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
    input:
      | CreateDirectScriptureProduct
      | CreateDerivativeScriptureProduct
      | CreateOtherProduct,
    session: Session
  ): Promise<AnyProduct> {
    const engagement = await this.repo.getBaseNode(
      input.engagementId,
      'Engagement'
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

    const otherInput: CreateOtherProduct | undefined =
      // @prettier-ignore
      has('title', input) ? input : undefined;
    const derivativeInput: CreateDerivativeScriptureProduct | undefined =
      // @prettier-ignore
      has('produces', input) ? input : undefined;
    const scriptureInput: CreateDirectScriptureProduct | undefined =
      !otherInput && !derivativeInput ? input : undefined;

    let totalVerses = 0;
    let totalVerseEquivalents = 0;

    let producibleType: ProducibleType | undefined = undefined;
    if (derivativeInput) {
      const producible = await this.repo.getBaseNode(
        derivativeInput.produces,
        'Producible'
      );
      if (!producible) {
        this.logger.warning(`Could not find producible node`, {
          id: derivativeInput.produces,
        });
        throw new NotFoundException(
          'Could not find producible node',
          'product.produces'
        );
      }
      producibleType = this.resources.resolveTypeByBaseNode(
        producible
      ) as ProducibleType;

      totalVerses = getTotalVerses(
        ...(derivativeInput.scriptureReferencesOverride ?? [])
      );
      totalVerseEquivalents = getTotalVerseEquivalents(
        ...(derivativeInput.scriptureReferencesOverride ?? [])
      );
    } else if (scriptureInput) {
      totalVerses = scriptureInput.unspecifiedScripture
        ? scriptureInput.unspecifiedScripture.totalVerses
        : getTotalVerses(...(scriptureInput.scriptureReferences ?? []));
      totalVerseEquivalents = scriptureInput.unspecifiedScripture
        ? getVerseEquivalentsFromUnspecified(
            scriptureInput.unspecifiedScripture
          )
        : getTotalVerseEquivalents(
            ...(scriptureInput.scriptureReferences ?? [])
          );
    }

    const type = has('title', input)
      ? ProducibleType.OtherProduct
      : producibleType ?? ProducibleType.DirectScriptureProduct;
    const availableSteps = getAvailableSteps({
      type,
      methodology: input.methodology,
    });
    const steps = intersection(availableSteps, input.steps);

    const progressTarget = simpleSwitch(input.progressStepMeasurement, {
      Percent: 100,
      Boolean: 1,
      Number: input.progressTarget ?? 1,
    });

    const id = has('title', input)
      ? await this.repo.createOther({ ...input, progressTarget, steps })
      : await this.repo.create({
          ...input,
          progressTarget,
          steps,
          totalVerses,
          totalVerseEquivalents,
        });

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
      const dto: UnsecuredDto<OtherProduct> = {
        ...props,
        title,
        description,
        scriptureReferences: scriptureReferencesValue,
      };
      return dto;
    }

    if (!producible) {
      const dto: UnsecuredDto<DirectScriptureProduct> = {
        ...props,
        scriptureReferences: scriptureReferencesValue,
      };
      return dto;
    }

    const dto: UnsecuredDto<DerivativeScriptureProduct> = {
      ...props,
      produces: producible,
      scriptureReferences: !isOverriding
        ? producible.scriptureReferences.value
        : scriptureReferencesValue,
      scriptureReferencesOverride: !isOverriding
        ? null
        : scriptureReferencesValue,
    };
    return dto;
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
      asProductType(DirectScriptureProduct)(dto),
      session
    );
    const direct: DirectScriptureProduct = {
      ...dto,
      totalVerses: dto.totalVerses ?? 0,
      totalVerseEquivalents: dto.totalVerseEquivalents ?? 0,
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

  /**
   * @deprecated
   */
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
      return await this.updateDirect(
        input,
        session,
        asProductType(DirectScriptureProduct)(currentProduct)
      );
    }

    // If current product is a Derivative Scripture Product, cannot update scriptureReferencesOverride
    if (input.scriptureReferences) {
      throw new InputException(
        'Cannot update Scripture References on a Derivative Scripture Product',
        'product.scriptureReferences'
      );
    }
    return await this.updateDerivative(input, session, currentProduct);
  }

  async updateDirect(
    input: UpdateDirectScriptureProduct,
    session: Session,
    currentProduct?: UnsecuredDto<DirectScriptureProduct>
  ): Promise<DirectScriptureProduct> {
    currentProduct ??= asProductType(DirectScriptureProduct)(
      await this.readOneUnsecured(input.id, session)
    );

    let changes = this.repo.getActualDirectChanges(currentProduct, input);
    changes = {
      ...changes,
      steps: this.restrictStepsChange(currentProduct, changes),
      progressTarget: this.restrictProgressTargetChange(
        currentProduct,
        input,
        changes
      ),
      unspecifiedScripture:
        input.unspecifiedScripture !== undefined &&
        !isEqual(currentProduct.unspecifiedScripture, {
          ...input.unspecifiedScripture, // spread to not compare class prototype
        })
          ? input.unspecifiedScripture
          : undefined,
    };
    if (
      changes.unspecifiedScripture !== undefined ||
      changes.scriptureReferences !== undefined
    ) {
      changes = {
        ...changes,
        totalVerses: changes.unspecifiedScripture
          ? changes.unspecifiedScripture.totalVerses
          : getTotalVerses(...(changes.scriptureReferences ?? [])),
        totalVerseEquivalents: changes.unspecifiedScripture
          ? getVerseEquivalentsFromUnspecified(changes.unspecifiedScripture)
          : getTotalVerseEquivalents(...(changes.scriptureReferences ?? [])),
      };
    }

    await this.authorizationService.verifyCanEditChanges(
      Product,
      await this.secure(currentProduct, session),
      changes,
      'product'
    );
    const { scriptureReferences, unspecifiedScripture, ...simpleChanges } =
      changes;

    await this.scriptureRefService.update(input.id, scriptureReferences);

    // update unspecifiedScripture if it's defined
    if (unspecifiedScripture !== undefined) {
      await this.repo.updateUnspecifiedScripture(
        input.id,
        unspecifiedScripture
      );
    }

    await this.mergeCompletionDescription(changes, currentProduct);

    const productUpdatedScriptureReferences = asProductType(
      DirectScriptureProduct
    )(await this.readOne(input.id, session));

    return await this.repo.updateProperties(
      productUpdatedScriptureReferences,
      simpleChanges
    );
  }

  async updateDerivative(
    input: UpdateDerivativeScriptureProduct,
    session: Session,
    currentProduct?: UnsecuredDto<DerivativeScriptureProduct>
  ): Promise<DerivativeScriptureProduct> {
    currentProduct ??= asProductType(DerivativeScriptureProduct)(
      await this.readOneUnsecured(input.id, session)
    );

    let changes = this.repo.getActualDerivativeChanges(
      // getChanges doesn't care if current is secured or not.
      // Applying this type so that the SetChangeType<> overrides still apply
      currentProduct as unknown as DerivativeScriptureProduct,
      input
    );
    changes = {
      ...changes,
      steps: this.restrictStepsChange(currentProduct, changes),
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
    if (changes.scriptureReferencesOverride !== undefined) {
      const scripture =
        changes.scriptureReferencesOverride ??
        currentProduct.produces.scriptureReferences.value;
      changes = {
        ...changes,
        totalVerses: getTotalVerses(...scripture),
        totalVerseEquivalents: getTotalVerseEquivalents(...scripture),
      };
    }

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

    const productUpdatedScriptureReferences = asProductType(
      DerivativeScriptureProduct
    )(await this.readOne(input.id, session));

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

    const currentSecured = asProductType(OtherProduct)(
      await this.secure(currentProduct, session)
    );
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

  private restrictStepsChange(
    current: Pick<
      UnsecuredDto<AnyProduct>,
      'methodology' | 'steps' | 'produces'
    >,
    changes: Partial<
      Pick<UpdateDirectScriptureProduct, 'methodology' | 'steps'>
    >
  ) {
    const methodology =
      changes.methodology !== undefined
        ? changes.methodology
        : current.methodology;
    const availableSteps = getAvailableSteps({
      type: current.produces
        ? current.produces.__typename
        : ProducibleType.DirectScriptureProduct,
      methodology,
    });
    const steps = intersection(
      availableSteps,
      changes.steps ? changes.steps : current.steps ?? []
    );
    // Check again to see if new steps value is different than current.
    // and return updated value or "no change".
    return !isSame(steps, current.steps) ? steps : undefined;
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

  async loadProductIdsForBookAndVerse(
    engagementId: ID,
    logger: ILogger = this.logger
  ) {
    const productRefs = await this.repo.listIdsAndScriptureRefs(engagementId);
    return productRefs.flatMap((productRef) => {
      const refs = productRef.scriptureRanges.map((raw) =>
        ScriptureRange.fromIds(raw)
      );
      const books = uniq([
        ...refs.flatMap((ref) => [ref.start.book, ref.end.book]),
        ...(productRef.unspecifiedScripture
          ? [productRef.unspecifiedScripture.book]
          : []),
      ]);
      const totalVerses =
        productRef.unspecifiedScripture?.totalVerses ??
        sumBy(productRef.scriptureRanges, (raw) => raw.end - raw.start + 1);

      const warn = (msg: string) =>
        logger.warning(`${msg} and is therefore ignored`, {
          product: productRef.id,
        });

      if (books.length === 0) {
        warn('Product has not defined any scripture ranges');
        return [];
      }
      if (books.length > 1) {
        warn('Product scripture range spans multiple books');
        return [];
      }
      const book: string = books[0];

      return {
        id: productRef.id,
        pnpIndex: productRef.pnpIndex,
        book,
        totalVerses,
      };
    });
  }

  async loadProductIdsByPnpIndex(engagementId: ID) {
    const productRefs = await this.repo.listIdsWithPnpIndexes(engagementId);
    return mapFromList(productRefs, (ref) => [ref.pnpIndex, ref.id]);
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

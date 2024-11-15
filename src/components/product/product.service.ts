import { Injectable } from '@nestjs/common';
import { asNonEmptyArray, mapEntries, simpleSwitch } from '@seedcompany/common';
import { intersection, sumBy, uniq } from 'lodash';
import {
  type ID,
  InputException,
  type ObjectView,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ILogger, Logger, ResourceResolver } from '~/core';
import { compareNullable, ifDiff, isSame } from '~/core/database/changes';
import { Privileges } from '../authorization';
import { EngagementService } from '../engagement';
import {
  getTotalVerseEquivalents,
  getTotalVerses,
  getVerseEquivalentsFromUnspecified,
  isScriptureEqual,
  ScriptureReferenceService,
} from '../scripture';
import { ScriptureRange, UnspecifiedScripturePortion } from '../scripture/dto';
import {
  type AnyProduct,
  asProductType,
  type CreateDerivativeScriptureProduct,
  type CreateDirectScriptureProduct,
  type CreateOtherProduct,
  DerivativeScriptureProduct,
  DirectScriptureProduct,
  getAvailableSteps,
  MethodologyToApproach,
  OtherProduct,
  ProducibleType,
  Product,
  type ProductApproach,
  type ProductCompletionDescriptionSuggestionsInput,
  type ProductListInput,
  type ProductListOutput,
  type ProductMethodology,
  resolveProductType,
  type UpdateDerivativeScriptureProduct,
  type UpdateDirectScriptureProduct,
  type UpdateOtherProduct,
  type UpdateBaseProduct as UpdateProduct,
} from './dto';
import { ProductRepository } from './product.repository';

@Injectable()
export class ProductService {
  constructor(
    private readonly scriptureRefs: ScriptureReferenceService,
    private readonly privileges: Privileges,
    private readonly repo: ProductRepository,
    private readonly engagementService: EngagementService,
    private readonly resources: ResourceResolver,
    @Logger('product:service') private readonly logger: ILogger,
  ) {}

  async create(
    input:
      | CreateDirectScriptureProduct
      | CreateDerivativeScriptureProduct
      | CreateOtherProduct,
  ): Promise<AnyProduct> {
    await this.engagementService.readOne(input.engagementId);

    const otherInput: CreateOtherProduct | undefined =
      // Double-checking not undefined seems safer here since a union type
      // could have this field declared as undefined.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      'title' in input && input.title !== undefined ? input : undefined;
    const derivativeInput: CreateDerivativeScriptureProduct | undefined =
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      'produces' in input && input.produces !== undefined ? input : undefined;
    const scriptureInput: CreateDirectScriptureProduct | undefined =
      !otherInput && !derivativeInput ? input : undefined;

    let totalVerses = 0;
    let totalVerseEquivalents = 0;

    let producibleType: ProducibleType | undefined = undefined;
    if (derivativeInput) {
      const { producible } = await this.repo.findProducible(
        derivativeInput.produces,
      );

      producibleType = this.resources.resolveTypeByBaseNode(
        producible,
      ) as ProducibleType;

      totalVerses = getTotalVerses(
        ...(derivativeInput.scriptureReferencesOverride ?? []),
      );
      totalVerseEquivalents = getTotalVerseEquivalents(
        ...(derivativeInput.scriptureReferencesOverride ?? []),
      );
    } else if (scriptureInput) {
      totalVerses = scriptureInput.unspecifiedScripture
        ? scriptureInput.unspecifiedScripture.totalVerses
        : getTotalVerses(...(scriptureInput.scriptureReferences ?? []));
      totalVerseEquivalents = scriptureInput.unspecifiedScripture
        ? getVerseEquivalentsFromUnspecified(
            scriptureInput.unspecifiedScripture,
          )
        : getTotalVerseEquivalents(
            ...(scriptureInput.scriptureReferences ?? []),
          );
    }

    const type = otherInput
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

    const created = otherInput
      ? await this.repo.createOther({ ...otherInput, progressTarget, steps })
      : 'produces' in input
      ? await this.repo.createDerivative({
          ...input,
          progressTarget,
          steps,
          totalVerses,
          totalVerseEquivalents,
        })
      : await this.repo.createDirect({
          ...input,
          progressTarget,
          steps,
          totalVerses,
          totalVerseEquivalents,
        });

    const securedCreated = this.secure(created);

    this.privileges
      .for(resolveProductType(securedCreated), securedCreated)
      .verifyCan('create');

    return securedCreated;
  }

  @HandleIdLookup([
    DirectScriptureProduct,
    DerivativeScriptureProduct,
    OtherProduct,
  ])
  async readOne(id: ID, _view?: ObjectView): Promise<AnyProduct> {
    const dto = await this.repo.readOneUnsecured(id);
    return this.secure(dto);
  }

  async readMany(ids: readonly ID[]): Promise<readonly AnyProduct[]> {
    const rows = await this.repo.readManyUnsecured(ids);
    return rows.map((row) => this.secure(row));
  }

  secure(dto: UnsecuredDto<AnyProduct>): AnyProduct {
    return this.privileges.for(resolveProductType(dto)).secure(dto);
  }

  async updateDirect(
    input: UpdateDirectScriptureProduct,
    currentProduct?: UnsecuredDto<DirectScriptureProduct>,
  ): Promise<DirectScriptureProduct> {
    currentProduct ??= asProductType(DirectScriptureProduct)(
      await this.repo.readOneUnsecured(input.id),
    );

    const changes = this.getDirectProductChanges(input, currentProduct);

    this.privileges
      .for(DirectScriptureProduct, currentProduct)
      .verifyChanges(changes, { pathPrefix: 'product' });

    const updated = await this.repo.updateDirectProperties({
      id: currentProduct.id,
      ...changes,
    });

    //TODO - perhaps move this into the repo?
    await this.mergeCompletionDescription(changes, currentProduct);

    return asProductType(DirectScriptureProduct)(this.secure(updated));
  }

  private getDirectProductChanges(
    input: UpdateDirectScriptureProduct,
    current: UnsecuredDto<DirectScriptureProduct>,
  ) {
    const partialChanges = this.repo.getActualDirectChanges(current, {
      ...input,
      // We'll compare below
      scriptureReferences: undefined,
    });

    let changes = {
      ...partialChanges,
      steps: this.restrictStepsChange(current, partialChanges),
      progressTarget: this.restrictProgressTargetChange(
        current,
        input,
        partialChanges,
      ),
      unspecifiedScripture: ifDiff(
        compareNullable(UnspecifiedScripturePortion.isEqual),
      )(input.unspecifiedScripture, current.unspecifiedScripture),
      scriptureReferences: ifDiff(isScriptureEqual)(
        input.scriptureReferences,
        current.scriptureReferences,
      ),
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

    return changes;
  }

  async updateDerivative(
    input: UpdateDerivativeScriptureProduct,
    currentProduct?: UnsecuredDto<DerivativeScriptureProduct>,
  ): Promise<DerivativeScriptureProduct> {
    currentProduct ??= asProductType(DerivativeScriptureProduct)(
      await this.repo.readOneUnsecured(input.id),
    );

    const changes = this.getDerivativeProductChanges(input, currentProduct);
    this.privileges
      .for(DerivativeScriptureProduct, currentProduct)
      .verifyChanges(changes, { pathPrefix: 'product' });

    const updated = await this.repo.updateDerivativeProperties({
      id: currentProduct.id,
      ...changes,
    });

    //TODO - perhaps move this into the repo?
    await this.mergeCompletionDescription(changes, currentProduct);

    return asProductType(DerivativeScriptureProduct)(this.secure(updated));
  }

  private getDerivativeProductChanges(
    input: UpdateDerivativeScriptureProduct,
    current: UnsecuredDto<DerivativeScriptureProduct>,
  ) {
    const partialChanges = this.repo.getActualDerivativeChanges(
      // getChanges doesn't care if current is secured or not.
      // Applying this type so that the SetChangeType<> overrides still apply
      current as unknown as DerivativeScriptureProduct,
      input,
    );

    let changes = {
      ...partialChanges,
      steps: this.restrictStepsChange(current, partialChanges),
      // This needs to be manually checked for changes as the existing value
      // is the object not the ID.
      produces:
        current.produces.id !== input.produces ? input.produces : undefined,
      progressTarget: this.restrictProgressTargetChange(
        current,
        input,
        partialChanges,
      ),
      scriptureReferencesOverride:
        input.scriptureReferencesOverride !== undefined &&
        !compareNullable(isScriptureEqual)(
          input.scriptureReferencesOverride,
          current.scriptureReferencesOverride
            ? current.scriptureReferencesOverride
            : null,
        )
          ? input.scriptureReferencesOverride
          : undefined,
    };

    if (changes.scriptureReferencesOverride !== undefined) {
      const scripture =
        changes.scriptureReferencesOverride ??
        current.produces.scriptureReferences;
      changes = {
        ...changes,
        totalVerses: getTotalVerses(...scripture),
        totalVerseEquivalents: getTotalVerseEquivalents(...scripture),
      };
    }

    return changes;
  }

  async updateOther(input: UpdateOtherProduct): Promise<OtherProduct> {
    const currentProduct = await this.repo.readOneUnsecured(input.id);

    if (!currentProduct.title) {
      throw new InputException('Product given is not an OtherProduct');
    }

    let changes = this.repo.getActualOtherChanges(currentProduct, input);
    changes = {
      ...changes,
      progressTarget: this.restrictProgressTargetChange(
        currentProduct,
        input,
        changes,
      ),
    };

    this.privileges
      .for(OtherProduct, currentProduct)
      .verifyChanges(changes, { pathPrefix: 'product' });

    await this.mergeCompletionDescription(changes, currentProduct);

    const updated = await this.repo.updateOther({
      id: currentProduct.id,
      ...changes,
    });

    return asProductType(OtherProduct)(this.secure(updated));
  }

  /**
   * Restrict progressTarget changes based on measurement restrictions
   */
  private restrictProgressTargetChange(
    currentProduct: Pick<UpdateProduct, 'progressStepMeasurement'>,
    input: Pick<UpdateProduct, 'progressTarget' | 'progressStepMeasurement'>,
    changes: Pick<UpdateProduct, 'progressTarget' | 'progressStepMeasurement'>,
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
      },
    );
  }

  private restrictStepsChange(
    current: Pick<
      UnsecuredDto<AnyProduct>,
      'methodology' | 'steps' | 'produces'
    >,
    changes: Partial<
      Pick<UpdateDirectScriptureProduct, 'methodology' | 'steps'>
    >,
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
      changes.steps ? changes.steps : current.steps ?? [],
    );
    // Check again to see if new steps value is different than current.
    // and return updated value or "no change".
    return !isSame(steps, current.steps) ? steps : undefined;
  }

  private async mergeCompletionDescription(
    changes: Partial<Pick<UpdateProduct, 'describeCompletion' | 'methodology'>>,
    currentProduct: UnsecuredDto<Product>,
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

  async delete(id: ID): Promise<void> {
    const object = await this.repo.readOneUnsecured(id);

    this.privileges.for(Product, object).verifyCan('delete');

    await this.repo.delete(object);
  }

  async list(input: ProductListInput): Promise<ProductListOutput> {
    // all roles can list, so no need to check canList for now
    const { items, ...results } = await this.repo.list(input);
    return {
      ...results,
      items: items.map((row) => this.secure(row)),
    };
  }

  async loadProductIdsForBookAndVerse(
    engagementId: ID,
    logger: ILogger = this.logger,
  ) {
    const productRefs = await this.repo.listIdsAndScriptureRefs(engagementId);
    return productRefs.flatMap((productRef) => {
      const refs = productRef.scriptureRanges.map((raw) =>
        ScriptureRange.fromIds(raw),
      );
      const bookList = uniq([
        ...refs.flatMap((ref) => [ref.start.book, ref.end.book]),
        ...(productRef.unspecifiedScripture
          ? [productRef.unspecifiedScripture.book]
          : []),
      ]);
      const books = asNonEmptyArray(bookList);
      const totalVerses =
        productRef.unspecifiedScripture?.totalVerses ??
        sumBy(productRef.scriptureRanges, (raw) => raw.end - raw.start + 1);

      const warn = (msg: string) =>
        logger.warning(`${msg} and is therefore ignored`, {
          product: productRef.id,
        });

      if (!books) {
        warn('Product has not defined any scripture ranges');
        return [];
      }
      if (books.length > 1) {
        warn('Product scripture range spans multiple books');
        return [];
      }
      const book = books[0];

      return {
        id: productRef.id,
        pnpIndex: productRef.pnpIndex,
        book,
        totalVerses,
        unspecifiedScripture: productRef.unspecifiedScripture,
        scriptureRanges: refs,
      };
    });
  }

  async loadProductIdsByPnpIndex(engagementId: ID, typeFilter?: string) {
    const productRefs = await this.repo.listIdsWithPnpIndexes(
      engagementId,
      typeFilter,
    );
    return mapEntries(productRefs, ({ id, pnpIndex }) => [pnpIndex, id]).asMap;
  }

  async loadProductIdsWithProducibleNames(
    engagementId: ID,
    type?: ProducibleType,
  ) {
    const refs = await this.repo.listIdsWithProducibleNames(engagementId, type);
    return mapEntries(refs, ({ id, name }) => [name, id]).asMap;
  }

  protected getMethodologiesByApproach(
    approach: ProductApproach,
  ): ProductMethodology[] {
    return Object.keys(MethodologyToApproach).filter(
      (key) => MethodologyToApproach[key as ProductMethodology] === approach,
    ) as ProductMethodology[];
  }

  async suggestCompletionDescriptions(
    input: ProductCompletionDescriptionSuggestionsInput,
  ) {
    return await this.repo.suggestCompletionDescriptions(input);
  }
}

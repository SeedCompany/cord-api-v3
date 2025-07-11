import { type ID, InputException } from '~/common';
import { type ProductStep } from '../product/dto';

export class StepNotPlannedException extends InputException {
  constructor(
    readonly productId: ID,
    readonly step: ProductStep,
    readonly index: number,
  ) {
    super('Step is not planned', `steps.${index}.step`);
  }
}

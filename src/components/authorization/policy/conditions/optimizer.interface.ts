import { Injectable, type Type } from '@nestjs/common';
import { createMetadataDecorator } from '@seedcompany/nest';
import { type Condition } from './condition.interface';

export const OptimizerWatermark = createMetadataDecorator({
  types: ['class'],
  additionalDecorators: [Injectable()],
});

export abstract class Optimizer {
  static register =
    () =>
    <Cls extends Type<Optimizer>>(cls: Cls) =>
      OptimizerWatermark()(cls);

  abstract optimize(condition: Condition): Condition;
}

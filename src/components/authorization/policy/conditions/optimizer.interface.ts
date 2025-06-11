import { applyDecorators, Injectable, SetMetadata, type Type } from '@nestjs/common';
import { type Condition } from './condition.interface';

export abstract class Optimizer {
  static register = () => (cls: Type<Optimizer>) =>
    applyDecorators(Injectable(), SetMetadata(Optimizer, true))(cls);

  abstract optimize(condition: Condition): Condition;
}

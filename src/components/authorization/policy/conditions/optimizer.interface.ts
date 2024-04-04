import { applyDecorators, Injectable, SetMetadata, Type } from '@nestjs/common';
import { Condition } from './condition.interface';

export abstract class Optimizer {
  static register = () => (cls: Type<Optimizer>) =>
    applyDecorators(Injectable(), SetMetadata(Optimizer, true))(cls);

  abstract optimize(condition: Condition): Condition;
}

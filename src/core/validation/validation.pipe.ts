import {
  ValidationPipe as BaseValidationPipe,
  Injectable,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { useContainer, ValidatorOptions } from 'class-validator';
import { ValidationException } from './validation.exception';

@Injectable()
export class ValidationPipe extends BaseValidationPipe {
  constructor(private readonly moduleRef: ModuleRef) {
    super({
      transform: true,
      skipMissingProperties: true,
      exceptionFactory: (es) => new ValidationException(es),
    });
  }
  private readonly containerForLib = {
    get: (type: any) => {
      if (type.name === 'CustomConstraint') {
        // Prototype-less constraints. Null to fall back to default, which just calls constructor once.
        return null;
      }
      return this.moduleRef.get(type);
    },
  };

  protected async validate(
    object: object,
    validatorOptions?: ValidatorOptions,
  ) {
    useContainer(this.containerForLib, { fallback: true });
    return await super.validate(object, validatorOptions);
  }
}

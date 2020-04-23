import {
  ValidationPipe as BaseValidationPipe,
  Injectable,
  ValidationError,
} from '@nestjs/common';

@Injectable()
export class ValidationPipe extends BaseValidationPipe {
  constructor() {
    super({
      transform: true,
      skipMissingProperties: true,
      exceptionFactory: (es) => new ValidationException(es),
    });
  }
}

export class ValidationException extends Error {
  constructor(readonly errors: ValidationError[]) {
    super();
  }
}

import {
  ValidationPipe as BaseValidationPipe,
  Injectable,
} from '@nestjs/common';
import { ValidationException } from './validation.exception';

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

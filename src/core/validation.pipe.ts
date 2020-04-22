import {
  ValidationPipe as BaseValidationPipe,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class ValidationPipe extends BaseValidationPipe {
  constructor() {
    super({
      transform: true,
      skipMissingProperties: true,
    });
  }
}

import { Module } from '@nestjs/common';
import { ValidatorModule } from '@seedcompany/nest';
import {
  ValidateIdPipe,
  ValidIdConstraint,
} from '~/common/validators/short-id.validator';
import { ValidationException } from './validation.exception';

@Module({
  imports: [
    ValidatorModule.register({
      transform: true,
      skipMissingProperties: true,
      exceptionFactory: (es) => new ValidationException(es),
    }),
  ],
  providers: [ValidIdConstraint, ValidateIdPipe],
  exports: [ValidatorModule, ValidateIdPipe],
})
export class ValidationModule {}

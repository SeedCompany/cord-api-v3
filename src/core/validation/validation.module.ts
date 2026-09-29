import { Module } from '@nestjs/common';
import { ValidatorModule } from '@seedcompany/nest';
import {
  IdResolver,
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
  // IdResolver is the no-op base: an id resolves to itself. It used to be
  // provided by the Gel module, which overrode it with an alias-resolving
  // implementation; it belongs with the validators that inject it.
  providers: [IdResolver, ValidIdConstraint, ValidateIdPipe],
  exports: [ValidatorModule, IdResolver, ValidateIdPipe],
})
export class ValidationModule {}

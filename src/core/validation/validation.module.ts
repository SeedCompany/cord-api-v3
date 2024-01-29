import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { Validator } from 'class-validator';
import {
  IdResolver,
  ValidateIdPipe,
  ValidIdConstraint,
} from '~/common/validators/short-id.validator';
import { ValidationPipe } from './validation.pipe';

@Module({
  providers: [
    Validator,
    ValidationPipe,
    { provide: APP_PIPE, useExisting: ValidationPipe },
    ValidIdConstraint,
    ValidateIdPipe,
    IdResolver,
  ],
  exports: [ValidationPipe, ValidateIdPipe, IdResolver],
})
export class ValidationModule {}

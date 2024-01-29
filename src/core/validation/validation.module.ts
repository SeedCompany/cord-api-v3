import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { Validator } from 'class-validator';
import { ValidationPipe } from './validation.pipe';

@Module({
  providers: [
    Validator,
    ValidationPipe,
    { provide: APP_PIPE, useExisting: ValidationPipe },
  ],
  exports: [ValidationPipe],
})
export class ValidationModule {}

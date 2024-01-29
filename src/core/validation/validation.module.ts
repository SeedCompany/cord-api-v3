import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from './validation.pipe';

@Module({
  providers: [
    ValidationPipe,
    { provide: APP_PIPE, useExisting: ValidationPipe },
  ],
  exports: [ValidationPipe],
})
export class ValidationModule {}

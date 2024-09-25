import { Module } from '@nestjs/common';
// eslint-disable-next-line @seedcompany/no-restricted-imports
import { HttpAdapterHost as HttpAdapterHostImpl } from '@nestjs/core';
import { HttpAdapterHost } from './http.adapter';

@Module({
  providers: [
    {
      provide: HttpAdapterHost,
      useExisting: HttpAdapterHostImpl,
    },
  ],
  exports: [HttpAdapterHost],
})
export class HttpModule {}

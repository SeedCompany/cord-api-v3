import { Module } from '@nestjs/common';
// eslint-disable-next-line @seedcompany/no-restricted-imports
import { HttpAdapterHost as HttpAdapterHostImpl } from '@nestjs/core';
import { setOf } from '@seedcompany/common';
import { getParentTypes } from '~/common';
import { HttpAdapter, HttpAdapterHost } from './http.adapter';

@Module({
  providers: [
    {
      provide: HttpAdapterHost,
      useExisting: HttpAdapterHostImpl,
    },
    {
      provide: HttpAdapter,
      inject: [HttpAdapterHost],
      useFactory: async (host: HttpAdapterHost) => {
        const availableKeys = setOf(
          getParentTypes(HttpAdapter).flatMap((cls) => [
            ...Object.getOwnPropertyNames(cls.prototype),
            ...Object.getOwnPropertySymbols(cls.prototype),
          ]),
        );
        return new Proxy(host, {
          get(_, key) {
            const { httpAdapter } = host;
            if (key === 'constructor') {
              return HttpAdapter.constructor;
            }
            if (!availableKeys.has(key)) {
              return undefined;
            }
            if (!httpAdapter) {
              throw new Error('HttpAdapter is not yet available');
            }
            const val = Reflect.get(httpAdapter, key, httpAdapter);
            return typeof val === 'function' ? val.bind(httpAdapter) : val;
          },
        });
      },
    },
  ],
  exports: [HttpAdapter, HttpAdapterHost],
})
export class HttpModule {}

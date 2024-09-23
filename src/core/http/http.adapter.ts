import compression from '@fastify/compress';
import cookieParser from '@fastify/cookie';
import cors from '@fastify/cors';
// eslint-disable-next-line @seedcompany/no-restricted-imports
import { HttpAdapterHost as HttpAdapterHostImpl } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import * as zlib from 'node:zlib';
import { ConfigService } from '~/core/config/config.service';
import type { CookieOptions, CorsOptions, IResponse } from './types';

export type NestHttpApplication = NestFastifyApplication & {
  configure: (
    app: NestFastifyApplication,
    config: ConfigService,
  ) => Promise<void>;
};

export class HttpAdapterHost extends HttpAdapterHostImpl<HttpAdapter> {}

export class HttpAdapter extends FastifyAdapter {
  async configure(app: NestFastifyApplication, config: ConfigService) {
    await app.register(compression, {
      brotliOptions: {
        params: {
          // This API returns text (JSON), so optimize for that
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        },
      },
    });

    await app.register(cors, {
      // typecast to undo deep readonly
      ...(config.cors as CorsOptions),
    });
    await app.register(cookieParser);

    app.setGlobalPrefix(config.hostUrl$.value.pathname.slice(1));

    config.applyTimeouts(app.getHttpServer(), config.httpTimeouts);
  }

  setCookie(
    response: IResponse,
    name: string,
    value: string,
    options: CookieOptions,
  ) {
    // Avoid linter wanting us to await sending response.
    // This method just returns the response instance for fluent interface.
    void response.cookie(name, value, options);
  }

  // @ts-expect-error we don't need to be compatible with base
  reply(
    response: IResponse | IResponse['raw'],
    body: any,
    statusCode?: number,
  ) {
    // Avoid linter wanting us to await sending response.
    // This method just returns the response instance for fluent interface.
    void super.reply(response, body, statusCode);
  }

  // @ts-expect-error we don't need to be compatible with base
  setHeader(response: IResponse, name: string, value: string) {
    // Avoid linter wanting us to await sending response.
    // This method just returns the response instance for fluent interface.
    void super.setHeader(response, name, value);
  }

  // @ts-expect-error we don't need to be compatible with base
  redirect(response: IResponse, statusCode: number, url: string) {
    // Avoid linter wanting us to await sending response.
    // This method just returns the response instance for fluent interface.
    void super.redirect(response, statusCode, url);
  }
}

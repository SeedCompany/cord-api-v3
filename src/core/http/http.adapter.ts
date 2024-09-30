// eslint-disable-next-line @seedcompany/no-restricted-imports
import { HttpAdapterHost as HttpAdapterHostImpl } from '@nestjs/core';
import {
  NestExpressApplication as BaseApplication,
  ExpressAdapter,
} from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { ConfigService } from '../config/config.service';
import type { CorsOptions } from './index';
import { CookieOptions, IResponse } from './types';

export type NestHttpApplication = BaseApplication & {
  configure: (app: BaseApplication, config: ConfigService) => Promise<void>;
};

export class HttpAdapterHost extends HttpAdapterHostImpl<HttpAdapter> {}

export class HttpAdapter extends ExpressAdapter {
  async configure(app: BaseApplication, config: ConfigService) {
    app.enableCors(config.cors as CorsOptions); // typecast to undo deep readonly
    app.use(cookieParser());

    app.setGlobalPrefix(config.hostUrl$.value.pathname.slice(1));

    config.applyTimeouts(app.getHttpServer(), config.httpTimeouts);
  }

  setCookie(
    response: IResponse,
    name: string,
    value: string,
    options: CookieOptions,
  ) {
    response.cookie(name, value, options);
  }
}

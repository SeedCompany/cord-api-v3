// eslint-disable-next-line @seedcompany/no-restricted-imports
import { HttpAdapterHost as HttpAdapterHostImpl } from '@nestjs/core';
import {
  ExpressAdapter,
  NestExpressApplication as NestHttpApplication,
} from '@nestjs/platform-express';
import { CookieOptions, IResponse } from './types';

export { type NestHttpApplication };

export class HttpAdapterHost extends HttpAdapterHostImpl<HttpAdapter> {}

export class HttpAdapter extends ExpressAdapter {
  setCookie(
    response: IResponse,
    name: string,
    value: string,
    options: CookieOptions,
  ) {
    response.cookie(name, value, options);
  }
}

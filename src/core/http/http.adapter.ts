// eslint-disable-next-line @seedcompany/no-restricted-imports
import { HttpAdapterHost as HttpAdapterHostImpl } from '@nestjs/core';
import {
  ExpressAdapter as HttpAdapter,
  NestExpressApplication as NestHttpApplication,
} from '@nestjs/platform-express';

export { HttpAdapter, type NestHttpApplication };

export class HttpAdapterHost extends HttpAdapterHostImpl<HttpAdapter> {}

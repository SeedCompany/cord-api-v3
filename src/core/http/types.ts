/* eslint-disable @typescript-eslint/method-signature-style */
// eslint-disable-next-line @seedcompany/no-restricted-imports
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Session } from '~/common';

// Exporting with I prefix to avoid ambiguity with web global types
export type { Request as IRequest, Response as IResponse };

export type HttpMiddleware = NestMiddleware<Request, Response>;

export { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
export { CookieOptions } from 'express';

declare module 'express' {
  export interface Request {
    session?: Session;
  }
}

declare module '@nestjs/common/interfaces/features/arguments-host.interface' {
  export interface HttpArgumentsHost {
    getRequest(): Request;
    getResponse(): Response;
    getNext(): (error?: Error) => void;
  }
}

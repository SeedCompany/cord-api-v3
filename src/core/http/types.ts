/* eslint-disable @typescript-eslint/method-signature-style */
import type {
  FastifyRequest as Request,
  FastifyReply as Response,
  RouteShorthandOptions,
} from 'fastify';
import type { Session } from '~/common';

// Exporting with I prefix to avoid ambiguity with web global types
export type { Request as IRequest, Response as IResponse };

export type HttpHooks = Required<{
  [Hook in keyof RouteShorthandOptions as Exclude<
    Extract<Hook, `${'pre' | 'on'}${string}`>,
    `${'prefix'}${string}`
  >]: Exclude<RouteShorthandOptions[Hook], any[]>;
}>;

export { FastifyCorsOptions as CorsOptions } from '@fastify/cors';
export { SerializeOptions as CookieOptions } from '@fastify/cookie';

declare module 'fastify' {
  export interface FastifyRequest {
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

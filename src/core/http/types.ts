/* eslint-disable @typescript-eslint/method-signature-style */
import type {
  FastifyRequest as Request,
  FastifyReply as Response,
  RouteShorthandOptions,
} from 'fastify';

// Exporting with I prefix to avoid ambiguity with web global types
export type { Request as IRequest, Response as IResponse };

export type HttpHooks = Required<{
  [Hook in keyof RouteShorthandOptions as Exclude<
    Extract<Hook, `${'pre' | 'on'}${string}`>,
    `${'prefix'}${string}`
  >]: Exclude<RouteShorthandOptions[Hook], any[]>;
}>;

export type { FastifyCorsOptions as CorsOptions } from '@fastify/cors';
export type { SerializeOptions as CookieOptions } from '@fastify/cookie';

declare module '@nestjs/common/interfaces/features/arguments-host.interface' {
  export interface HttpArgumentsHost {
    getRequest(): Request;
    getResponse(): Response;
    getNext(): (error?: Error) => void;
  }
}

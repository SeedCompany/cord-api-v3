/* eslint-disable @typescript-eslint/method-signature-style */
// eslint-disable-next-line @seedcompany/no-restricted-imports
import type { NestMiddleware } from '@nestjs/common';
import type {
  FastifyRequest as Request,
  FastifyReply as Response,
} from 'fastify';
import type { Session } from '~/common';

// Exporting with I prefix to avoid ambiguity with web global types
export type { Request as IRequest, Response as IResponse };

export type HttpMiddleware = NestMiddleware<Request['raw'], Response['raw']>;

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

import {
  FASTIFY_ROUTE_CONFIG_METADATA,
  FASTIFY_ROUTE_CONSTRAINTS_METADATA,
} from '@nestjs/platform-fastify/constants.js';
import { Many } from '@seedcompany/common';
import { createMetadataDecorator } from '@seedcompany/nest';
import { FastifyContextConfig } from 'fastify';
import type { RouteConstraint } from 'fastify/types/route';

export const RouteConstraints = createMetadataDecorator({
  key: FASTIFY_ROUTE_CONSTRAINTS_METADATA,
  types: ['class', 'method'],
  setter: (config: RouteConstraint) => config,
});

export const RouteConfig = createMetadataDecorator({
  key: FASTIFY_ROUTE_CONFIG_METADATA,
  types: ['class', 'method'],
  setter: (config: FastifyContextConfig) => config,
});

/**
 * @example
 * ```ts
 * @RawBody()
 * route(
 *   @Request('rawBody') raw: string,
 *   @Body() contents: JSON
 * ) {}
 * ```
 * @example
 * ```ts
 * @RawBody({ passthrough: true })
 * route(
 *   @Body() contents: Buffer
 * ) {}
 * ```
 */
export const RawBody = createMetadataDecorator({
  types: ['class', 'method'],
  setter: (
    config: {
      /**
       * Pass the raw body through to the handler or
       * just to keep the raw body in addition to regular content parsing.
       */
      passthrough?: boolean;
      /**
       * The allowed content types.
       * Only applicable if passthrough is true.
       * Defaults to '*'
       */
      allowContentTypes?: Many<string> | RegExp;
    } = {},
  ) => config,
});

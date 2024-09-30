import {
  FASTIFY_ROUTE_CONFIG_METADATA,
  FASTIFY_ROUTE_CONSTRAINTS_METADATA,
} from '@nestjs/platform-fastify/constants.js';
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

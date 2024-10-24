import { YogaDriverServerContext } from '@graphql-yoga/nestjs';
import { createMetadataDecorator } from '@seedcompany/nest';
import { Plugin as PluginNoContext } from 'graphql-yoga';
import { GqlContextType } from '~/common';

export const Plugin = createMetadataDecorator({
  types: ['class'],
});

export type Plugin = PluginNoContext<
  GqlContextType,
  YogaDriverServerContext<'fastify'>
>;

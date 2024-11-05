import { createMetadataDecorator } from '@seedcompany/nest';
import { Plugin as PluginNoContext } from 'graphql-yoga';
import { GqlContextType } from '~/common';
import { ServerContext } from './driver';

export const Plugin = createMetadataDecorator({
  types: ['class'],
});

export type Plugin = PluginNoContext<GqlContextType, ServerContext>;

import { createMetadataDecorator } from '@seedcompany/nest';
import { type Plugin as PluginNoContext } from 'graphql-yoga';
import { type GqlContextType } from '~/common';
import { type ServerContext } from './driver';

export const Plugin = createMetadataDecorator({
  types: ['class'],
  // eslint-disable-next-line @typescript-eslint/no-inferrable-types
  setter: (priority: number = 0) => ({ priority }),
});

export type Plugin = PluginNoContext<GqlContextType, ServerContext>;

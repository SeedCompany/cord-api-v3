import { GraphQLSchemaHost } from '@nestjs/graphql';
import { EnhancedResourceMap } from '~/core';
import { ResourcesHost } from './resources.host';

describe('ResourcesHost', () => {
  let host: ResourcesHost;
  let all: EnhancedResourceMap;

  beforeAll(async () => {
    // Load all files to ensure all resources are registered
    await import('../../app.module');

    host = new ResourcesHost(new GraphQLSchemaHost());
    all = host.getEnhancedMap();
  });

  describe('By EdgeDB', () => {
    it('FQN', () => {
      const res = host.getByEdgeDB('default::User');
      expect(res).toBeDefined();
      expect(res).toBe(all.User);
    });
    it('Implicit default module', () => {
      const res = host.getByEdgeDB('User');
      expect(res).toBe(all.User);
    });
    it('GQL Name different from FQN', () => {
      const res = host.getByEdgeDB('Ceremony');
      expect(res).toBe(all.Ceremony);
    });
  });
});

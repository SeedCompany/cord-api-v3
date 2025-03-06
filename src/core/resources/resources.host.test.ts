import { GraphQLSchemaHost } from '@nestjs/graphql';
import { EnhancedResourceMap } from '~/core';
import { ResourcesHost } from './resources.host';

// Load all files to ensure all resources are registered
import '../../app.module';

describe('ResourcesHost', () => {
  let host: ResourcesHost;
  let all: EnhancedResourceMap;

  beforeAll(async () => {
    host = new ResourcesHost(new GraphQLSchemaHost());
    all = host.getEnhancedMap();
  });

  describe('By Gel', () => {
    it('FQN', () => {
      const res = host.getByGel('default::User');
      expect(res).toBeDefined();
      expect(res).toBe(all.User);
    });
    it('Implicit default module', () => {
      const res = host.getByGel('User');
      expect(res).toBe(all.User);
    });
    it('GQL Name different from FQN', () => {
      const res = host.getByGel('Ceremony');
      expect(res).toBe(all.Ceremony);
    });
  });
});

import { EnhancedResource } from '~/common';
import type { ResourceLike } from '~/core';
import { ServerException } from './exception';

export class CreationFailed extends ServerException {
  readonly resource: EnhancedResource<any>;
  constructor(
    resource: ResourceLike,
    options?: { message?: string; cause?: Error },
  ) {
    const res = EnhancedResource.resolve(resource);
    super(options?.message ?? `Failed to create ${res.name}`, options?.cause);
    this.resource = res;
  }
}

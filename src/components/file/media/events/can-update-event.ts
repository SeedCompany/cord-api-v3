import { Inject, Injectable, Optional, Scope } from '@nestjs/common';
import { CachedByArg as Once } from '@seedcompany/common';
import { PollVoter } from '~/common';
import { ResourceResolver, ResourcesHost } from '~/core';
import { AnyMedia, MediaUserMetadata } from '../media.dto';

/**
 * An attempt to update the media metadata.
 * Vote with `allowUpdate` to control whether the update is allowed.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class CanUpdateMediaUserMetadataEvent {
  @Inject() private readonly resourceHost: ResourcesHost;
  @Inject() private readonly resourceResolver: ResourceResolver;

  constructor(
    @Optional() readonly media: AnyMedia,
    @Optional() readonly input: MediaUserMetadata,
    @Optional() readonly allowUpdate: PollVoter<boolean>,
  ) {}

  @Once() async getAttachedResource() {
    const attachedResName = this.resourceResolver.resolveTypeByBaseNode(
      this.media.attachedTo[0],
    );
    const attachedResource = await this.resourceHost.getByName(attachedResName);
    return attachedResource;
  }
}

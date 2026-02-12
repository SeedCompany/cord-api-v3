import { Inject, Injectable, Optional, Scope } from '@nestjs/common';
import { CachedByArg as Once } from '@seedcompany/common';
import { Polls } from '~/common';
import { ResourceResolver, ResourcesHost } from '~/core';
import { type AnyMedia, MediaUserMetadata } from '../media.dto';

/**
 * An attempt to update the media metadata.
 * Vote with `allowUpdate` to control whether the update is allowed.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class CanUpdateMediaUserMetadataHook {
  @Inject() private readonly resourceHost: ResourcesHost;
  @Inject() private readonly resourceResolver: ResourceResolver;

  constructor(
    @Optional() readonly media: AnyMedia,
    @Optional() readonly input: MediaUserMetadata,
    @Optional() readonly allowUpdate: Polls.BallotBox<boolean>,
  ) {}

  @Once() getAttachedResource() {
    const attachedResName = this.resourceResolver.resolveTypeByBaseNode(
      this.media.attachedTo[0],
    );
    const attachedResource = this.resourceHost.getByName(attachedResName);
    return attachedResource;
  }
}

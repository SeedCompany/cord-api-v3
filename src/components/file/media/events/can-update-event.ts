import { Injectable, Optional, Scope } from '@nestjs/common';
import { PollVoter } from '~/common';
import { AnyMedia, MediaUserMetadata } from '../media.dto';

/**
 * An attempt to update the media metadata.
 * Vote with `allowUpdate` to control whether the update is allowed.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class CanUpdateMediaUserMetadataEvent {
  constructor(
    @Optional() readonly media: AnyMedia,
    @Optional() readonly input: MediaUserMetadata,
    @Optional() readonly allowUpdate: PollVoter<boolean>,
  ) {}
}

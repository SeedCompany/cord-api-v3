import { PollVoter } from '~/common';
import { AnyMedia, MediaUserMetadata } from '../media.dto';

/**
 * An attempt to update the media metadata.
 * Vote with `allowUpdate` to control whether the update is allowed.
 */
export class CanUpdateMediaUserMetadataEvent {
  constructor(
    readonly media: AnyMedia,
    readonly input: MediaUserMetadata,
    readonly allowUpdate: PollVoter<boolean>,
  ) {}
}

import { Module } from '@nestjs/common';
import { ChangesetAwareResolver } from './changeset-aware.resolver';
import { ChangesetLoader } from './changeset.loader';
import { ChangesetRepository } from './changeset.repository';
import { ChangesetResolver } from './changeset.resolver';

@Module({
  providers: [
    ChangesetAwareResolver,
    ChangesetResolver,
    ChangesetLoader,
    ChangesetRepository,
  ],
})
export class ChangesetModule {}

import { Module } from '@nestjs/common';
import { ChangesetAwareResolver } from './changeset-aware.resolver';
import { ChangesetRepository } from './changeset.repository';
import { ChangesetResolver } from './changeset.resolver';

@Module({
  providers: [ChangesetAwareResolver, ChangesetResolver, ChangesetRepository],
})
export class ChangesetModule {}

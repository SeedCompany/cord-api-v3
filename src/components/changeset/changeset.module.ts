import { Module } from '@nestjs/common';
import { ChangesetAwareResolver } from './changeset-aware.resolver';
import { ChangesetRepository } from './changeset.repository';

@Module({
  providers: [ChangesetAwareResolver, ChangesetRepository],
})
export class ChangesetModule {}

import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ChangesetAwareResolver } from './changeset-aware.resolver';
import { ChangesetRepository } from './changeset.repository';
import { ChangesetResolver } from './changeset.resolver';
import { EnforceChangesetEditablePipe } from './enforce-changeset-editable.pipe';

@Module({
  providers: [
    ChangesetAwareResolver,
    ChangesetResolver,
    ChangesetRepository,
    { provide: APP_PIPE, useClass: EnforceChangesetEditablePipe },
  ],
})
export class ChangesetModule {}

import { Injectable } from '@nestjs/common';
import { OnHook } from '~/core/hooks';
import { AuditService } from './audit.service';
import { ResourceMutatedHook } from './resource-mutated.hook';

/**
 * Writes one audit-log row per resource mutation, in the firing transaction.
 */
@Injectable()
@OnHook(ResourceMutatedHook)
export class AuditLogHandler {
  constructor(private readonly audit: AuditService) {}

  async handle(hook: ResourceMutatedHook) {
    await this.audit.record(hook);
  }
}

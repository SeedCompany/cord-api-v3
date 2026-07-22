import { type ID } from '~/common';
import { type MutationAction } from './dto/resource-mutation.dto';

/**
 * Generic mutation event for the audit log. Domain services fire this (in
 * addition to their own hooks) on create/update/delete; the audit listener
 * writes one row per event, in the same transaction.
 *
 * `changes` is the diffed field set (from `repo.getActualChanges`) for updates;
 * omit for create/delete.
 */
export class ResourceMutatedHook {
  constructor(
    readonly resourceType: string,
    readonly resourceId: ID,
    readonly action: MutationAction,
    readonly changes?: Record<string, unknown> | null,
  ) {}
}

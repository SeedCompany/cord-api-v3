import { Injectable } from '@nestjs/common';
import {
  type ID,
  NotFoundException,
  NotImplementedException,
  type UnsecuredDto,
} from '~/common';
import {
  type ProjectChangeRequest,
  type ProjectChangeRequestListInput,
} from './dto';

/**
 * Postgres implementation of ProjectChangeRequestRepository.
 *
 * Changesets are NOT being carried forward to Postgres — there is no
 * project_change_requests table and no plan for one. But the
 * `Project.changeRequests` field is still in the GraphQL schema and cord-field's
 * live `ProjectOverview` document selects it, so every project page load hits
 * this repo. Left routed to Neo4j it threw
 * `Neo4jError: Failed to connect` and broke the whole project page under
 * DATABASE=postgres.
 *
 * So reads answer truthfully — there are no change requests in Postgres, hence
 * an empty list — while writes fail loudly rather than silently pretending to
 * succeed. Same posture as `ProjectFilters.partnerId`.
 *
 * migration-todo: when the changeset feature is formally removed, delete this
 * repo along with the whole project-change-request component and the
 * `Project.changeRequests` field (coordinated with cord-field dropping it from
 * ProjectOverview).
 */
@Injectable()
export class ProjectChangeRequestDrizzleRepository {
  async list(_input: ProjectChangeRequestListInput) {
    return {
      items: [] as ReadonlyArray<UnsecuredDto<ProjectChangeRequest>>,
      total: 0,
      hasMore: false,
    };
  }

  async readMany(
    _ids: readonly ID[],
  ): Promise<ReadonlyArray<UnsecuredDto<ProjectChangeRequest>>> {
    return [];
  }

  async readOne(id: ID): Promise<UnsecuredDto<ProjectChangeRequest>> {
    throw new NotFoundException(
      `Change requests do not exist under Postgres (${id})`,
    );
  }

  async create(_input: unknown): Promise<never> {
    throw new NotImplementedException(
      'Change requests are not supported under Postgres — the changeset feature is not being carried forward.',
    );
  }

  async update(_changes: unknown): Promise<never> {
    throw new NotImplementedException(
      'Change requests are not supported under Postgres — the changeset feature is not being carried forward.',
    );
  }

  async deleteNode(_objectOrId: unknown): Promise<never> {
    throw new NotImplementedException(
      'Change requests are not supported under Postgres — the changeset feature is not being carried forward.',
    );
  }

  /**
   * Services call this to diff an existing DTO against an Update input. Nothing
   * can exist to update, so the only reachable caller already threw in
   * `readOne`; return no changes rather than pretending otherwise.
   */
  getActualChanges() {
    return {};
  }
}

import { mapEntries } from '@seedcompany/common';
import { asNonEmpty, DateOverrideConflictException } from '~/common';
import { ResourceLoader } from '~/core';
import { OnHook } from '~/core/hooks';
import { OrganizationLoader } from '../../organization';
import { ProjectUpdatedHook } from '../../project/hooks';
import { PartnershipService } from '../partnership.service';

@OnHook(ProjectUpdatedHook, -10)
export class ValidatePartnershipDateOverridesOnProjectChangeHandler {
  constructor(
    private readonly partnerships: PartnershipService,
    private readonly resources: ResourceLoader,
  ) {}

  async handle(event: ProjectUpdatedHook) {
    const { updated: project, changes } = event;

    if (changes.mouStart === undefined && changes.mouEnd === undefined) {
      return;
    }

    const canonical = { start: project.mouStart, end: project.mouEnd };
    const partnerships = await this.partnerships.listAllByProjectId(project.id);
    const conflicts = DateOverrideConflictException.findConflicts(
      canonical,
      partnerships.map((partnership) => ({
        __typename: 'Partnership',
        id: partnership.id,
        label: partnership.id,
        start: partnership.mouStartOverride,
        end: partnership.mouEndOverride,
      })),
    );
    if (!conflicts) return;
    const orgLoader = await this.resources.getLoader(OrganizationLoader);
    const partnershipToOrg = mapEntries(partnerships, (p) => [
      p.id,
      p.organization.id,
    ]).asRecord;
    const orgs = await orgLoader.loadMany(
      conflicts.map((conflict) => partnershipToOrg[conflict.id]!),
    );
    const conflictsWithLabels = conflicts.map((conflict, index) => {
      const org = orgs[index]!;
      if (org instanceof Error) {
        // Shouldn't happen
        return conflict;
      }
      return {
        ...conflict,
        label: org.name.value ?? conflict.id,
      };
    });
    throw new DateOverrideConflictException(
      {
        __typename: event.resource.name,
        id: project.id,
        name: project.name,
      },
      canonical,
      ['A partnership', 'Some partnerships'],
      asNonEmpty(conflictsWithLabels)!,
    );
  }
}

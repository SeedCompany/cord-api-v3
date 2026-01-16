import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { Grandparent, mapSecuredValue } from '~/common';
import { FieldRegionLoader } from '../field-region';
import { SecuredFieldRegion } from '../field-region/dto';
import { LocationLoader } from '../location';
import { SecuredLocation } from '../location/dto';
import { ProjectChanges, ProjectUpdated } from './dto';
import { ProjectLoader } from './project.loader';

@Resolver(ProjectChanges)
export class ProjectChangesLinksResolver {
  @ResolveField(() => SecuredLocation, {
    // Secured objects should actually be nullable in this `Changes` object
    // as unchanged is null.
    nullable: true,
  })
  async primaryLocation(
    @Grandparent() updated: ProjectUpdated,
    @Parent() changes: ProjectChanges,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation | null> {
    if (changes.primaryLocation === undefined) {
      return null;
    }
    const project = await projects.load({
      id: updated.projectId,
      view: { active: true },
    });
    return await mapSecuredValue(
      {
        ...project.primaryLocation,
        value: changes.primaryLocation,
      },
      ({ id }) => locations.load(id),
    );
  }

  @ResolveField(() => SecuredLocation, {
    nullable: true,
  })
  async marketingLocation(
    @Grandparent() updated: ProjectUpdated,
    @Parent() changes: ProjectChanges,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation | null> {
    if (changes.marketingLocation === undefined) {
      return null;
    }
    const project = await projects.load({
      id: updated.projectId,
      view: { active: true },
    });
    return await mapSecuredValue(
      {
        ...project.marketingLocation,
        value: changes.marketingLocation,
      },
      ({ id }) => locations.load(id),
    );
  }

  @ResolveField(() => SecuredLocation, {
    nullable: true,
  })
  async marketingRegionOverride(
    @Grandparent() updated: ProjectUpdated,
    @Parent() changes: ProjectChanges,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation | null> {
    if (changes.marketingRegionOverride === undefined) {
      return null;
    }
    const project = await projects.load({
      id: updated.projectId,
      view: { active: true },
    });
    return await mapSecuredValue(
      {
        ...project.marketingRegionOverride,
        value: changes.marketingRegionOverride,
      },
      ({ id }) => locations.load(id),
    );
  }

  @ResolveField(() => SecuredFieldRegion, {
    nullable: true,
  })
  async fieldRegion(
    @Grandparent() updated: ProjectUpdated,
    @Parent() changes: ProjectChanges,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(FieldRegionLoader) regions: LoaderOf<FieldRegionLoader>,
  ): Promise<SecuredFieldRegion | null> {
    if (changes.fieldRegion === undefined) {
      return null;
    }
    const project = await projects.load({
      id: updated.projectId,
      view: { active: true },
    });
    return await mapSecuredValue(
      {
        ...project.fieldRegion,
        value: changes.fieldRegion,
      },
      ({ id }) => regions.load(id),
    );
  }
}

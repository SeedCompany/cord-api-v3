import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { Grandparent, mapSecuredValue } from '~/common';
import { FieldRegionLoader } from '../field-region';
import { SecuredFieldRegion } from '../field-region/dto';
import { LocationLoader } from '../location';
import { SecuredLocation } from '../location/dto';
import { ProjectUpdate, ProjectUpdated } from './dto';
import { ProjectLoader } from './project.loader';

@Resolver(ProjectUpdate)
export class ProjectUpdateLinksResolver {
  @ResolveField(() => SecuredLocation, {
    // Secured objects should actually be nullable in this `Update` object
    // as unchanged is null.
    nullable: true,
  })
  async primaryLocation(
    @Grandparent() updated: ProjectUpdated,
    @Parent() update: ProjectUpdate,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation | null> {
    if (update.primaryLocation === undefined) {
      return null;
    }
    const project = await projects.load({
      id: updated.projectId,
      view: { active: true },
    });
    return await mapSecuredValue(
      {
        ...project.primaryLocation,
        value: update.primaryLocation,
      },
      ({ id }) => locations.load(id),
    );
  }

  @ResolveField(() => SecuredLocation, {
    nullable: true,
  })
  async marketingLocation(
    @Grandparent() updated: ProjectUpdated,
    @Parent() update: ProjectUpdate,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation | null> {
    if (update.marketingLocation === undefined) {
      return null;
    }
    const project = await projects.load({
      id: updated.projectId,
      view: { active: true },
    });
    return await mapSecuredValue(
      {
        ...project.marketingLocation,
        value: update.marketingLocation,
      },
      ({ id }) => locations.load(id),
    );
  }

  @ResolveField(() => SecuredLocation, {
    nullable: true,
  })
  async marketingRegionOverride(
    @Grandparent() updated: ProjectUpdated,
    @Parent() update: ProjectUpdate,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation | null> {
    if (update.marketingRegionOverride === undefined) {
      return null;
    }
    const project = await projects.load({
      id: updated.projectId,
      view: { active: true },
    });
    return await mapSecuredValue(
      {
        ...project.marketingRegionOverride,
        value: update.marketingRegionOverride,
      },
      ({ id }) => locations.load(id),
    );
  }

  @ResolveField(() => SecuredFieldRegion, {
    nullable: true,
  })
  async fieldRegion(
    @Grandparent() updated: ProjectUpdated,
    @Parent() update: ProjectUpdate,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(FieldRegionLoader) regions: LoaderOf<FieldRegionLoader>,
  ): Promise<SecuredFieldRegion | null> {
    if (update.fieldRegion === undefined) {
      return null;
    }
    const project = await projects.load({
      id: updated.projectId,
      view: { active: true },
    });
    return await mapSecuredValue(
      {
        ...project.fieldRegion,
        value: update.fieldRegion,
      },
      ({ id }) => regions.load(id),
    );
  }
}

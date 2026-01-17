import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { asNonEmptyArray } from '@seedcompany/common';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import {
  CollectionMutationType,
  Grandparent,
  loadManyIgnoreMissingThrowAny,
  mapSecuredValue,
  SecuredList,
} from '~/common';
import { Privileges } from '../authorization';
import { FieldRegionLoader } from '../field-region';
import { SecuredFieldRegion } from '../field-region/dto';
import { LocationLoader } from '../location';
import { SecuredLocation, SecuredLocationList } from '../location/dto';
import { IProject, ProjectUpdate, ProjectUpdated } from './dto';
import { ProjectLoader } from './project.loader';

@Resolver(ProjectUpdate)
export class ProjectUpdateLinksResolver {
  constructor(private readonly privileges: Privileges) {}

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

  @ResolveField(() => SecuredLocationList, {
    nullable: true,
  })
  async otherLocations(
    @Args({
      name: 'mutation',
      type: () => CollectionMutationType,
      // Could be nullable in the future, to emit the entire list, but we don't
      // have that currently without going to DB to collect it.
      // We also don't really need it because
      // ProjectUpdated.project.otherLocations gives it.
      nullable: false,
    })
    type: CollectionMutationType,
    @Grandparent() updated: ProjectUpdated,
    @Parent() update: ProjectUpdate,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList | null> {
    const ids = asNonEmptyArray(update.otherLocations?.[type] ?? []);
    if (!ids) {
      return null;
    }

    const project = await projects.load({
      id: updated.projectId,
      view: { active: true },
    });

    const perms = this.privileges
      .for(IProject, project)
      .forEdge('otherLocations');
    if (!perms.can('read')) {
      return SecuredList.Redacted;
    }

    const items = await loadManyIgnoreMissingThrowAny(locations, ids);

    return {
      canRead: true,
      canCreate: false, // meaningless here
      items,
      hasMore: false,
      total: ids.length,
    };
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

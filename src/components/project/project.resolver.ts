import {
  Args,
  ArgsType,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  firstLettersOfWords,
  ID,
  IdArg,
  IdField,
  LoggedInSession,
  mapSecuredValue,
  NotFoundException,
  SecuredDateRange,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { SecuredBudget } from '../budget';
import { IdsAndView, IdsAndViewArg } from '../changeset/dto';
import {
  EngagementListInput,
  EngagementLoader,
  SecuredEngagementList,
} from '../engagement';
import { FieldRegionLoader, SecuredFieldRegion } from '../field-region';
import { asDirectory, FileNodeLoader, SecuredDirectory } from '../file';
import {
  LocationListInput,
  LocationLoader,
  SecuredLocation,
  SecuredLocationList,
} from '../location';
import { OrganizationLoader, SecuredOrganization } from '../organization';
import { PartnershipListInput, SecuredPartnershipList } from '../partnership';
import {
  ProjectChangeRequestListInput,
  SecuredProjectChangeRequestList,
} from '../project-change-request/dto';
import {
  CreateProjectInput,
  CreateProjectOutput,
  IProject,
  Project,
  ProjectListInput,
  ProjectListOutput,
  UpdateProjectInput,
  UpdateProjectOutput,
} from './dto';
import {
  ProjectMemberListInput,
  ProjectMemberLoader,
  SecuredProjectMemberList,
} from './project-member';
import { ProjectLoader } from './project.loader';
import { ProjectService } from './project.service';

@ArgsType()
class ModifyOtherLocationArgs {
  @IdField()
  projectId: ID;

  @IdField()
  locationId: ID;
}

@Resolver(IProject)
export class ProjectResolver {
  constructor(private readonly projectService: ProjectService) {}

  @Query(() => IProject, {
    description: 'Look up a project by its ID',
  })
  async project(
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @IdsAndViewArg() key: IdsAndView
  ): Promise<Project> {
    return await projects.load(key);
  }

  @Query(() => ProjectListOutput, {
    description: 'Look up projects',
  })
  async projects(
    @Args({
      name: 'input',
      type: () => ProjectListInput,
      nullable: true,
      defaultValue: ProjectListInput.defaultVal,
    })
    input: ProjectListInput,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @AnonSession() session: Session
  ): Promise<ProjectListOutput> {
    const list = await this.projectService.list(input, session);
    projects.primeAll(list.items);
    return list;
  }

  @ResolveField(() => String, { nullable: true })
  avatarLetters(@Parent() project: Project): string | undefined {
    return project.name.canRead && project.name.value
      ? firstLettersOfWords(project.name.value)
      : undefined;
  }

  @ResolveField(() => SecuredProjectChangeRequestList)
  async changeRequests(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @Args({
      name: 'input',
      type: () => ProjectChangeRequestListInput,
      nullable: true,
      defaultValue: ProjectChangeRequestListInput.defaultVal,
    })
    input: ProjectChangeRequestListInput
  ): Promise<SecuredProjectChangeRequestList> {
    return await this.projectService.listChangeRequests(
      project,
      input,
      session
    );
  }

  @ResolveField(() => SecuredBudget, {
    description: `The project's current budget`,
  })
  async budget(
    @Parent() project: Project,
    @AnonSession() session: Session
  ): Promise<SecuredBudget> {
    return await this.projectService.currentBudget(
      project,
      session,
      project.changeset
    );
  }

  @ResolveField(() => SecuredEngagementList)
  async engagements(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @Args({
      name: 'input',
      type: () => EngagementListInput,
      nullable: true,
      defaultValue: EngagementListInput.defaultVal,
    })
    input: EngagementListInput,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>
  ): Promise<SecuredEngagementList> {
    const list = await this.projectService.listEngagements(
      project,
      input,
      session,
      project.changeset ? { changeset: project.changeset } : { active: true }
    );
    engagements.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredProjectMemberList, {
    description: 'The project members',
  })
  async team(
    @AnonSession() session: Session,
    @Parent() { id, sensitivity, scope }: Project,
    @Args({
      name: 'input',
      type: () => ProjectMemberListInput,
      defaultValue: ProjectMemberListInput.defaultVal,
    })
    input: ProjectMemberListInput,
    @Loader(ProjectMemberLoader) projectMembers: LoaderOf<ProjectMemberLoader>
  ): Promise<SecuredProjectMemberList> {
    const list = await this.projectService.listProjectMembers(
      id,
      input,
      session,
      sensitivity,
      scope
    );
    projectMembers.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredPartnershipList)
  async partnerships(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @Args({
      name: 'input',
      type: () => PartnershipListInput,
      defaultValue: PartnershipListInput.defaultVal,
    })
    input: PartnershipListInput
  ): Promise<SecuredPartnershipList> {
    return await this.projectService.listPartnerships(
      project.id,
      input,
      session,
      project.sensitivity,
      project.scope,
      project.changeset
    );
  }

  @ResolveField(() => SecuredDirectory, {
    description: 'The root filesystem directory of this project',
  })
  async rootDirectory(
    @Parent() project: Project,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<SecuredDirectory> {
    if (!project.rootDirectory.canRead) {
      return {
        canEdit: false,
        canRead: false,
        value: undefined,
      };
    }
    if (!project.rootDirectory.value) {
      throw new NotFoundException(
        'Could not find root directory associated to this project'
      );
    }

    const dir = asDirectory(await files.load(project.rootDirectory.value));
    return {
      canRead: true,
      canEdit: false, // rootDirectory of project unchangeable
      value: dir,
    };
  }

  @ResolveField(() => SecuredLocation)
  async primaryLocation(
    @Parent() project: Project,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>
  ): Promise<SecuredLocation> {
    return await mapSecuredValue(project.primaryLocation, (id) =>
      locations.load(id)
    );
  }

  @ResolveField(() => SecuredLocationList)
  async otherLocations(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>
  ): Promise<SecuredLocationList> {
    const list = await this.projectService.listOtherLocations(
      project,
      input,
      session
    );
    locations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredLocation)
  async marketingLocation(
    @Parent() project: Project,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>
  ): Promise<SecuredLocation> {
    return await mapSecuredValue(project.marketingLocation, (id) =>
      locations.load(id)
    );
  }

  @ResolveField(() => SecuredFieldRegion)
  async fieldRegion(
    @Parent() project: Project,
    @Loader(FieldRegionLoader) fieldRegions: LoaderOf<FieldRegionLoader>
  ): Promise<SecuredFieldRegion> {
    return await mapSecuredValue(project.fieldRegion, (id) =>
      fieldRegions.load(id)
    );
  }

  @ResolveField(() => SecuredOrganization)
  async owningOrganization(
    @Parent() project: Project,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>
  ): Promise<SecuredOrganization> {
    return await mapSecuredValue(project.owningOrganization, (id) =>
      organizations.load(id)
    );
  }

  @ResolveField()
  mouRange(@Parent() project: Project): SecuredDateRange {
    return SecuredDateRange.fromPair(project.mouStart, project.mouEnd);
  }

  @Mutation(() => CreateProjectOutput, {
    description: 'Create a project',
  })
  async createProject(
    @Args('input') { project: input }: CreateProjectInput,
    @LoggedInSession() session: Session
  ): Promise<CreateProjectOutput> {
    const project = await this.projectService.create(input, session);
    const secured = await this.projectService.secure(project, session);
    return { project: secured };
  }

  @Mutation(() => UpdateProjectOutput, {
    description: 'Update a project',
  })
  async updateProject(
    @Args('input') { project: input, changeset }: UpdateProjectInput,
    @LoggedInSession() session: Session
  ): Promise<UpdateProjectOutput> {
    const project = await this.projectService.update(input, session, changeset);
    const secured = await this.projectService.secure(project, session);
    return { project: secured };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a project',
  })
  async deleteProject(
    @IdArg() id: ID,
    @LoggedInSession() session: Session
  ): Promise<boolean> {
    await this.projectService.delete(id, session);
    return true;
  }

  @Mutation(() => IProject, {
    description: 'Add a location to a project',
  })
  async addOtherLocationToProject(
    @LoggedInSession() session: Session,
    @Args() { projectId, locationId }: ModifyOtherLocationArgs
  ): Promise<Project> {
    await this.projectService.addOtherLocation(projectId, locationId, session);
    return await this.projectService.readOne(projectId, session);
  }

  @Mutation(() => IProject, {
    description: 'Remove a location from a project',
  })
  async removeOtherLocationFromProject(
    @LoggedInSession() session: Session,
    @Args() { projectId, locationId }: ModifyOtherLocationArgs
  ): Promise<Project> {
    await this.projectService.removeOtherLocation(
      projectId,
      locationId,
      session
    );
    return await this.projectService.readOne(projectId, session);
  }
}

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
  NotFoundException,
  SecuredDateRange,
  Session,
} from '../../common';
import { DataLoader, Loader, LoaderOf } from '../../core';
import { SecuredBudget } from '../budget';
import { IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { EngagementListInput, SecuredEngagementList } from '../engagement';
import { FieldRegionService, SecuredFieldRegion } from '../field-region';
import { asDirectory, FileNode, IFileNode, SecuredDirectory } from '../file';
import {
  LocationListInput,
  LocationService,
  SecuredLocation,
  SecuredLocationList,
} from '../location';
import { OrganizationService, SecuredOrganization } from '../organization';
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
  SecuredProjectMemberList,
} from './project-member/dto';
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
  constructor(
    private readonly projectService: ProjectService,
    private readonly locationService: LocationService,
    private readonly fieldRegionService: FieldRegionService,
    private readonly organizationService: OrganizationService
  ) {}

  @Query(() => IProject, {
    description: 'Look up a project by its ID',
  })
  async project(
    @Loader(IProject) projects: LoaderOf<ProjectLoader>,
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
    @AnonSession() session: Session
  ): Promise<ProjectListOutput> {
    const list = await this.projectService.list(input, session);
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
    return this.projectService.listChangeRequests(project, input, session);
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
    input: EngagementListInput
  ): Promise<SecuredEngagementList> {
    return this.projectService.listEngagements(
      project,
      input,
      session,
      project.changeset ? { changeset: project.changeset } : { active: true }
    );
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
    input: ProjectMemberListInput
  ): Promise<SecuredProjectMemberList> {
    return this.projectService.listProjectMembers(
      id,
      input,
      session,
      sensitivity,
      scope
    );
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
    return this.projectService.listPartnerships(
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
    @Loader(IFileNode) files: DataLoader<FileNode>
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
      canEdit: false,
      value: dir,
    };
  }

  @ResolveField(() => SecuredLocation)
  async primaryLocation(
    @Parent() project: Project,
    @AnonSession() session: Session
  ): Promise<SecuredLocation> {
    const { value: id, ...rest } = project.primaryLocation;
    const value = id
      ? await this.locationService.readOne(id, session)
      : undefined;
    return { value, ...rest };
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
    input: LocationListInput
  ): Promise<SecuredLocationList> {
    return this.projectService.listOtherLocations(project, input, session);
  }

  @ResolveField(() => SecuredLocation)
  async marketingLocation(
    @Parent() project: Project,
    @AnonSession() session: Session
  ): Promise<SecuredLocation> {
    const { value: id, ...rest } = project.marketingLocation;
    const value = id
      ? await this.locationService.readOne(id, session)
      : undefined;
    return { value, ...rest };
  }

  @ResolveField(() => SecuredFieldRegion)
  async fieldRegion(
    @Parent() project: Project,
    @AnonSession() session: Session
  ): Promise<SecuredFieldRegion> {
    const { value: id, ...rest } = project.fieldRegion;
    const value = id
      ? await this.fieldRegionService.readOne(id, session)
      : undefined;
    return { value, ...rest };
  }

  @ResolveField(() => SecuredOrganization)
  async owningOrganization(
    @Parent() project: Project,
    @AnonSession() session: Session
  ): Promise<SecuredOrganization> {
    const { value: id, ...rest } = project.owningOrganization;
    const value = id
      ? await this.organizationService.readOne(id, session)
      : undefined;
    return { value, ...rest };
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

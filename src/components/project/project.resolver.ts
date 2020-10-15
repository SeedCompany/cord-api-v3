import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  firstLettersOfWords,
  IdArg,
  ISession,
  SecuredString,
  Session,
} from '../../common';
import { SecuredBudget } from '../budget';
import { EngagementListInput, SecuredEngagementList } from '../engagement';
import { FieldRegionService, SecuredFieldRegion } from '../field-region';
import { SecuredDirectory } from '../file';
import {
  LocationListInput,
  LocationService,
  SecuredLocation,
  SecuredLocationList,
} from '../location';
import { PartnershipListInput, SecuredPartnershipList } from '../partnership';
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
import { ProjectService } from './project.service';

@Resolver(IProject)
export class ProjectResolver {
  constructor(
    private readonly projectService: ProjectService,
    private readonly locationService: LocationService,
    private readonly fieldRegionService: FieldRegionService
  ) {}

  @Query(() => IProject, {
    description: 'Look up a project by its ID',
  })
  async project(
    @IdArg() id: string,
    @Session() session: ISession
  ): Promise<Project> {
    const project = await this.projectService.readOne(id, session);
    // @ts-expect-error hack project id into step object so the lazy transitions
    // field resolver can use it
    project.step.projectId = project.id;
    return project;
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
    @Session() session: ISession
  ): Promise<ProjectListOutput> {
    const list = await this.projectService.list(input, session);
    for (const project of list.items) {
      // @ts-expect-error hack project id into step object so the lazy transitions
      // field resolver can use it
      project.step.projectId = project.id;
    }
    return list;
  }

  @ResolveField(() => String, { nullable: true })
  avatarLetters(@Parent() project: Project): string | undefined {
    return project.name.canRead && project.name.value
      ? firstLettersOfWords(project.name.value)
      : undefined;
  }

  /** @deprecated Moved from field definition in DTO to here */
  @ResolveField(() => SecuredString, {
    description: 'The legacy department ID',
    deprecationReason: 'Use `Project.departmentId` instead',
  })
  deptId(@Parent() project: Project): SecuredString {
    return project.departmentId;
  }

  @ResolveField(() => SecuredBudget, {
    description: `The project's current budget`,
  })
  async budget(
    @Parent() project: Project,
    @Session() session: ISession
  ): Promise<SecuredBudget> {
    return await this.projectService.currentBudget(project, session);
  }

  @ResolveField(() => SecuredEngagementList)
  async engagements(
    @Session() session: ISession,
    @Parent() project: Project,
    @Args({
      name: 'input',
      type: () => EngagementListInput,
      nullable: true,
      defaultValue: EngagementListInput.defaultVal,
    })
    input: EngagementListInput
  ): Promise<SecuredEngagementList> {
    return this.projectService.listEngagements(project, input, session);
  }

  @ResolveField(() => SecuredProjectMemberList, {
    description: 'The project members',
  })
  async team(
    @Session() session: ISession,
    @Parent() { id }: Project,
    @Args({
      name: 'input',
      type: () => ProjectMemberListInput,
      defaultValue: ProjectMemberListInput.defaultVal,
    })
    input: ProjectMemberListInput
  ): Promise<SecuredProjectMemberList> {
    return this.projectService.listProjectMembers(id, input, session);
  }

  @ResolveField(() => SecuredPartnershipList)
  async partnerships(
    @Session() session: ISession,
    @Parent() { id }: Project,
    @Args({
      name: 'input',
      type: () => PartnershipListInput,
      defaultValue: PartnershipListInput.defaultVal,
    })
    input: PartnershipListInput
  ): Promise<SecuredPartnershipList> {
    return this.projectService.listPartnerships(id, input, session);
  }

  @ResolveField(() => SecuredDirectory, {
    description: 'The root filesystem directory of this project',
  })
  async rootDirectory(
    @Session() session: ISession,
    @Parent() { id }: Project
  ): Promise<SecuredDirectory> {
    return await this.projectService.getRootDirectory(id, session);
  }

  @ResolveField(() => SecuredLocation)
  async primaryLocation(
    @Parent() project: Project,
    @Session() session: ISession
  ): Promise<SecuredLocation> {
    const { value: id, ...rest } = project.primaryLocation;
    const value = id
      ? await this.locationService.readOne(id, session)
      : undefined;
    return { value, ...rest };
  }

  @ResolveField(() => SecuredLocationList)
  async otherLocations(
    @Session() session: ISession,
    @Parent() { id }: Project,
    @Args({
      name: 'input',
      type: () => LocationListInput,
      defaultValue: LocationListInput.defaultVal,
    })
    input: LocationListInput
  ): Promise<SecuredLocationList> {
    return this.projectService.listOtherLocations(id, input, session);
  }

  @ResolveField(() => SecuredLocation)
  async marketingLocation(
    @Parent() project: Project,
    @Session() session: ISession
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
    @Session() session: ISession
  ): Promise<SecuredFieldRegion> {
    const { value: id, ...rest } = project.fieldRegion;
    const value = id
      ? await this.fieldRegionService.readOne(id, session)
      : undefined;
    return { value, ...rest };
  }

  @Mutation(() => CreateProjectOutput, {
    description: 'Create a project',
  })
  async createProject(
    @Args('input') { project: input }: CreateProjectInput,
    @Session() session: ISession
  ): Promise<CreateProjectOutput> {
    const project = await this.projectService.create(input, session);
    // @ts-expect-error hack project id into step object so the lazy transitions
    // field resolver can use it
    project.step.projectId = project.id;
    return { project };
  }

  @Mutation(() => UpdateProjectOutput, {
    description: 'Update a project',
  })
  async updateProject(
    @Args('input') { project: input }: UpdateProjectInput,
    @Session() session: ISession
  ): Promise<UpdateProjectOutput> {
    const project = await this.projectService.update(input, session);
    // @ts-expect-error hack project id into step object so the lazy transitions
    // field resolver can use it
    project.step.projectId = project.id;
    return { project };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a project',
  })
  async deleteProject(
    @IdArg() id: string,
    @Session() session: ISession
  ): Promise<boolean> {
    await this.projectService.delete(id, session);
    return true;
  }

  @Mutation(() => IProject, {
    description: 'Add a location to a project',
  })
  async addOtherLocationToProject(
    @Session() session: ISession,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('locationId', { type: () => ID }) locationId: string
  ): Promise<Project> {
    await this.projectService.addOtherLocation(projectId, locationId, session);
    return this.projectService.readOne(projectId, session);
  }

  @Mutation(() => IProject, {
    description: 'Remove a location from a project',
  })
  async removeOtherLocationFromProject(
    @Session() session: ISession,
    @Args('projectId', { type: () => ID }) projectId: string,
    @Args('locationId', { type: () => ID }) locationId: string
  ): Promise<Project> {
    await this.projectService.removeOtherLocation(
      projectId,
      locationId,
      session
    );
    return this.projectService.readOne(projectId, session);
  }

  @Query(() => Boolean, {
    description: 'Check Consistency in Project Nodes',
  })
  async checkProjectConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return await this.projectService.consistencyChecker(session);
  }
}

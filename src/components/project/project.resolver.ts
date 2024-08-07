import {
  Args,
  ArgsType,
  Info,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  Fields,
  firstLettersOfWords,
  ID,
  IdArg,
  IdField,
  IsOnly,
  ListArg,
  LoggedInSession,
  mapSecuredValue,
  NotFoundException,
  SecuredDateRange,
  Session,
} from '~/common';
import { Loader, LoaderOf } from '~/core';
import { SecuredBudget } from '../budget/dto';
import { IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { EngagementLoader } from '../engagement';
import { EngagementListInput, SecuredEngagementList } from '../engagement/dto';
import { FieldRegionLoader } from '../field-region';
import { SecuredFieldRegion } from '../field-region/dto';
import { FileNodeLoader } from '../file';
import { asDirectory, SecuredDirectory } from '../file/dto';
import { LocationLoader } from '../location';
import {
  LocationListInput,
  SecuredLocation,
  SecuredLocationList,
} from '../location/dto';
import { OrganizationLoader } from '../organization';
import { SecuredOrganization } from '../organization/dto';
import {
  PartnershipByProjectAndPartnerLoader,
  PartnershipLoader,
} from '../partnership';
import {
  Partnership,
  PartnershipListInput,
  SecuredPartnership,
  SecuredPartnershipList,
} from '../partnership/dto';
import { ProjectChangeRequestLoader } from '../project-change-request';
import {
  ProjectChangeRequestListInput,
  SecuredProjectChangeRequestList,
} from '../project-change-request/dto';
import {
  CreateProjectInput,
  CreateProjectOutput,
  DeleteProjectOutput,
  InternshipProjectListOutput,
  IProject,
  Project,
  ProjectListInput,
  ProjectListOutput,
  ProjectType,
  TranslationProjectListOutput,
  UpdateProjectInput,
  UpdateProjectOutput,
} from './dto';
import { ProjectMemberLoader } from './project-member';
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
  constructor(private readonly projectService: ProjectService) {}

  @Query(() => IProject, {
    description: 'Look up a project by its ID',
  })
  async project(
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @IdsAndViewArg() key: IdsAndView,
  ): Promise<Project> {
    return await projects.load(key);
  }

  @Query(() => ProjectListOutput, {
    description: 'Look up projects',
  })
  async projects(
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @AnonSession() session: Session,
  ): Promise<ProjectListOutput> {
    const list = await this.projectService.list(input, session);
    projects.primeAll(list.items);
    return list;
  }

  @Query(() => TranslationProjectListOutput, {
    description: 'Look up translation projects',
  })
  async translationProjects(
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @AnonSession() session: Session,
  ): Promise<ProjectListOutput> {
    const list = await this.projectService.list(
      {
        ...input,
        filter: {
          ...input.filter,
          type: [
            ProjectType.MomentumTranslation,
            ProjectType.MultiplicationTranslation,
          ],
        },
      },
      session,
    );
    projects.primeAll(list.items);
    return list;
  }

  @Query(() => InternshipProjectListOutput, {
    description: 'Look up internship projects',
  })
  async internshipProjects(
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @AnonSession() session: Session,
  ): Promise<ProjectListOutput> {
    const list = await this.projectService.list(
      {
        ...input,
        filter: {
          ...input.filter,
          type: [ProjectType.Internship],
        },
      },
      session,
    );
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
    @ListArg(ProjectChangeRequestListInput)
    input: ProjectChangeRequestListInput,
    @Loader(ProjectChangeRequestLoader)
    projectChangeRequests: LoaderOf<ProjectChangeRequestLoader>,
  ): Promise<SecuredProjectChangeRequestList> {
    const list = await this.projectService.listChangeRequests(
      project,
      input,
      session,
    );
    projectChangeRequests.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredBudget, {
    description: `The project's current budget`,
  })
  async budget(
    @Parent() project: Project,
    @AnonSession() session: Session,
  ): Promise<SecuredBudget> {
    return await this.projectService.currentBudget(
      project,
      session,
      project.changeset,
    );
  }

  @ResolveField(() => SecuredEngagementList)
  async engagements(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @ListArg(EngagementListInput) input: EngagementListInput,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    @Info(Fields, IsOnly<SecuredEngagementList>(['total'])) onlyTotal: boolean,
  ) {
    // Optimize total for listing. Note that input filters could affect this
    // number, but currently there's nothing exposed that does so this is safe.
    if (onlyTotal) {
      return { total: project.engagementTotal };
    }

    const list = await this.projectService.listEngagements(
      project,
      input,
      session,
      project.changeset ? { changeset: project.changeset } : { active: true },
    );
    engagements.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredProjectMemberList, {
    description: 'The project members',
  })
  async team(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @ListArg(ProjectMemberListInput) input: ProjectMemberListInput,
    @Loader(ProjectMemberLoader) projectMembers: LoaderOf<ProjectMemberLoader>,
  ): Promise<SecuredProjectMemberList> {
    const list = await this.projectService.listProjectMembers(
      project,
      input,
      session,
    );
    projectMembers.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredPartnershipList)
  async partnerships(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @ListArg(PartnershipListInput) input: PartnershipListInput,
    @Loader(PartnershipLoader) partnerships: LoaderOf<PartnershipLoader>,
  ): Promise<SecuredPartnershipList> {
    const list = await this.projectService.listPartnerships(
      project,
      input,
      session,
      project.changeset,
    );
    partnerships.primeAll(list.items);
    return list;
  }

  @ResolveField(() => Partnership)
  async partnership(
    @Parent() project: Project,
    @IdArg({ name: 'partner' }) partnerId: ID,
    @Loader(PartnershipByProjectAndPartnerLoader)
    loader: LoaderOf<PartnershipByProjectAndPartnerLoader>,
  ): Promise<Partnership> {
    const result = await loader.load({
      project: project.id,
      partner: partnerId,
    });
    return result.partnership;
  }

  @ResolveField(() => SecuredDirectory, {
    description: 'The root filesystem directory of this project',
  })
  async rootDirectory(
    @Parent() project: Project,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredDirectory> {
    if (!project.rootDirectory.canRead) {
      return {
        canEdit: false,
        canRead: false,
        value: undefined,
      };
    }
    if (!project.rootDirectory.value?.id) {
      throw new NotFoundException(
        'Could not find root directory associated to this project',
      );
    }

    const dir = asDirectory(await files.load(project.rootDirectory.value.id));
    return {
      canRead: true,
      canEdit: false, // rootDirectory of project unchangeable
      value: dir,
    };
  }

  @ResolveField(() => SecuredPartnership)
  async primaryPartnership(
    @Parent() project: Project,
    @Loader(PartnershipLoader) partnerships: LoaderOf<PartnershipLoader>,
  ): Promise<SecuredPartnership> {
    return await mapSecuredValue(project.primaryPartnership, ({ id }) =>
      partnerships.load({ id, view: { active: true } }),
    );
  }

  @ResolveField(() => SecuredLocation)
  async primaryLocation(
    @Parent() project: Project,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation> {
    return await mapSecuredValue(project.primaryLocation, ({ id }) =>
      locations.load(id),
    );
  }

  @ResolveField(() => SecuredLocationList)
  async otherLocations(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @ListArg(LocationListInput) input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList> {
    const list = await this.projectService.listOtherLocations(
      project,
      input,
      session,
    );
    locations.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredLocation)
  async marketingLocation(
    @Parent() project: Project,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation> {
    return await mapSecuredValue(project.marketingLocation, ({ id }) =>
      locations.load(id),
    );
  }

  @ResolveField(() => SecuredLocation)
  async marketingRegionOverride(
    @Parent() project: Project,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation> {
    return await mapSecuredValue(project.marketingRegionOverride, ({ id }) =>
      locations.load(id),
    );
  }

  @ResolveField(() => SecuredFieldRegion)
  async fieldRegion(
    @Parent() project: Project,
    @Loader(FieldRegionLoader) fieldRegions: LoaderOf<FieldRegionLoader>,
  ): Promise<SecuredFieldRegion> {
    return await mapSecuredValue(project.fieldRegion, ({ id }) =>
      fieldRegions.load(id),
    );
  }

  @ResolveField(() => SecuredOrganization)
  async owningOrganization(
    @Parent() project: Project,
    @Loader(OrganizationLoader) organizations: LoaderOf<OrganizationLoader>,
  ): Promise<SecuredOrganization> {
    return await mapSecuredValue(project.owningOrganization, ({ id }) =>
      organizations.load(id),
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
    @LoggedInSession() session: Session,
  ): Promise<CreateProjectOutput> {
    const project = await this.projectService.create(input, session);
    const secured = this.projectService.secure(project, session);
    return { project: secured };
  }

  @Mutation(() => UpdateProjectOutput, {
    description: 'Update a project',
  })
  async updateProject(
    @Args('input') { project: input, changeset }: UpdateProjectInput,
    @LoggedInSession() session: Session,
  ): Promise<UpdateProjectOutput> {
    const project = await this.projectService.update(input, session, changeset);
    const secured = this.projectService.secure(project, session);
    return { project: secured };
  }

  @Mutation(() => DeleteProjectOutput, {
    description: 'Delete a project',
  })
  async deleteProject(
    @IdArg() id: ID,
    @LoggedInSession() session: Session,
  ): Promise<DeleteProjectOutput> {
    await this.projectService.delete(id, session);
    return { success: true };
  }

  @Mutation(() => IProject, {
    description: 'Add a location to a project',
  })
  async addOtherLocationToProject(
    @LoggedInSession() session: Session,
    @Args() { projectId, locationId }: ModifyOtherLocationArgs,
  ): Promise<Project> {
    await this.projectService.addOtherLocation(projectId, locationId);
    return await this.projectService.readOne(projectId, session);
  }

  @Mutation(() => IProject, {
    description: 'Remove a location from a project',
  })
  async removeOtherLocationFromProject(
    @LoggedInSession() session: Session,
    @Args() { projectId, locationId }: ModifyOtherLocationArgs,
  ): Promise<Project> {
    await this.projectService.removeOtherLocation(projectId, locationId);
    return await this.projectService.readOne(projectId, session);
  }
}

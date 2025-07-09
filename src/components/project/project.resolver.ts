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
  Fields,
  firstLettersOfWords,
  type ID,
  IdArg,
  IdField,
  InputException,
  IsOnly,
  ListArg,
  mapSecuredValue,
  NotFoundException,
  OptionalField,
  SecuredDateRange,
} from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { SecuredBudget } from '../budget/dto';
import { type IdsAndView, IdsAndViewArg } from '../changeset/dto';
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
  type Project,
  ProjectListInput,
  ProjectListOutput,
  ProjectType,
  TranslationProject,
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

@ArgsType()
class IsMemberArgs {
  @OptionalField({
    description: 'Consider inactive memberships as well',
  })
  includeInactive?: boolean;
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

  @Query(() => TranslationProject, {
    description: 'Look up a translation project by its ID',
  })
  async translationProject(
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
    @IdsAndViewArg() key: IdsAndView,
  ): Promise<TranslationProject> {
    const project = await projects.load(key);
    if (project.type === ProjectType.Internship) {
      throw new InputException('Project is not a translation project');
    }
    return project;
  }

  @Query(() => ProjectListOutput, {
    description: 'Look up projects',
  })
  async projects(
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<ProjectListOutput> {
    const list = await this.projectService.list(input);
    projects.primeAll(list.items);
    return list;
  }

  @Query(() => TranslationProjectListOutput, {
    description: 'Look up translation projects',
  })
  async translationProjects(
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<ProjectListOutput> {
    const list = await this.projectService.list({
      ...input,
      filter: {
        ...input.filter,
        type: [
          ProjectType.MomentumTranslation,
          ProjectType.MultiplicationTranslation,
        ],
      },
    });
    projects.primeAll(list.items);
    return list;
  }

  @Query(() => InternshipProjectListOutput, {
    description: 'Look up internship projects',
  })
  async internshipProjects(
    @ListArg(ProjectListInput) input: ProjectListInput,
    @Loader(ProjectLoader) projects: LoaderOf<ProjectLoader>,
  ): Promise<ProjectListOutput> {
    const list = await this.projectService.list({
      ...input,
      filter: {
        ...input.filter,
        type: [ProjectType.Internship],
      },
    });
    projects.primeAll(list.items);
    return list;
  }

  @ResolveField(() => Boolean, {
    description: 'Is the requesting user a member of this project?',
  })
  isMember(
    @Parent() project: Project,
    @Args() { includeInactive }: IsMemberArgs,
  ): boolean {
    return (
      !!project.membership &&
      (includeInactive ? true : !project.membership.inactiveAt)
    );
  }

  @ResolveField(() => String, { nullable: true })
  avatarLetters(@Parent() project: Project): string | undefined {
    return project.name.canRead && project.name.value
      ? firstLettersOfWords(project.name.value)
      : undefined;
  }

  @ResolveField(() => SecuredProjectChangeRequestList)
  async changeRequests(
    @Parent() project: Project,
    @ListArg(ProjectChangeRequestListInput)
    input: ProjectChangeRequestListInput,
    @Loader(ProjectChangeRequestLoader)
    projectChangeRequests: LoaderOf<ProjectChangeRequestLoader>,
  ): Promise<SecuredProjectChangeRequestList> {
    const list = await this.projectService.listChangeRequests(project, input);
    projectChangeRequests.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredBudget, {
    description: `The project's current budget`,
  })
  async budget(@Parent() project: Project): Promise<SecuredBudget> {
    return await this.projectService.currentBudget(project, project.changeset);
  }

  @ResolveField(() => SecuredEngagementList)
  async engagements(
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
      project.changeset ? { changeset: project.changeset } : { active: true },
    );
    engagements.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredProjectMemberList, {
    description: 'The project members',
  })
  async team(
    @Parent() project: Project,
    @ListArg(ProjectMemberListInput) input: ProjectMemberListInput,
    @Loader(ProjectMemberLoader) projectMembers: LoaderOf<ProjectMemberLoader>,
  ): Promise<SecuredProjectMemberList> {
    const list = await this.projectService.listProjectMembers(project, input);
    projectMembers.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredPartnershipList)
  async partnerships(
    @Parent() project: Project,
    @ListArg(PartnershipListInput) input: PartnershipListInput,
    @Loader(PartnershipLoader) partnerships: LoaderOf<PartnershipLoader>,
  ): Promise<SecuredPartnershipList> {
    const list = await this.projectService.listPartnerships(
      project,
      input,
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
    @Parent() project: Project,
    @ListArg(LocationListInput) input: LocationListInput,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList> {
    const list = await this.projectService.listOtherLocations(project, input);
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
  ): Promise<CreateProjectOutput> {
    const project = await this.projectService.create(input);
    const secured = this.projectService.secure(project);
    return { project: secured };
  }

  @Mutation(() => UpdateProjectOutput, {
    description: 'Update a project',
  })
  async updateProject(
    @Args('input') { project: input, changeset }: UpdateProjectInput,
  ): Promise<UpdateProjectOutput> {
    const project = await this.projectService.update(input, changeset);
    const secured = this.projectService.secure(project);
    return { project: secured };
  }

  @Mutation(() => DeleteProjectOutput, {
    description: 'Delete a project',
  })
  async deleteProject(@IdArg() id: ID): Promise<DeleteProjectOutput> {
    await this.projectService.delete(id);
    return { success: true };
  }

  @Mutation(() => IProject, {
    description: 'Add a location to a project',
  })
  async addOtherLocationToProject(
    @Args() { projectId, locationId }: ModifyOtherLocationArgs,
  ): Promise<Project> {
    await this.projectService.addOtherLocation(projectId, locationId);
    return await this.projectService.readOne(projectId);
  }

  @Mutation(() => IProject, {
    description: 'Remove a location from a project',
  })
  async removeOtherLocationFromProject(
    @Args() { projectId, locationId }: ModifyOtherLocationArgs,
  ): Promise<Project> {
    await this.projectService.removeOtherLocation(projectId, locationId);
    return await this.projectService.readOne(projectId);
  }
}

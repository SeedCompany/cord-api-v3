import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, IdArg, LoggedInSession, Session } from '../../../common';
import { FileService, SecuredFile } from '../../file';
import {
  CreateProjectReportInput,
  CreateProjectReportOutput,
  ProjectReport,
  ProjectReportListInput,
  ProjectReportListOutput,
  UpdateProjectReportInput,
  UpdateProjectReportOutput,
} from './dto';
import { ProjectReportService } from './project-report.service';

@Resolver(ProjectReport)
export class ProjectReportResolver {
  constructor(
    private readonly service: ProjectReportService,
    private readonly files: FileService
  ) {}

  @ResolveField(() => SecuredFile, {
    description: 'The project report file',
  })
  async reportFile(
    @Parent() projectReport: ProjectReport,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(
      projectReport.reportFile,
      session
    );
  }

  @Mutation(() => CreateProjectReportOutput, {
    description: 'Create a project member',
  })
  async createProjectReport(
    @LoggedInSession() session: Session,
    @Args('input') { projectReport: input }: CreateProjectReportInput
  ): Promise<CreateProjectReportOutput> {
    const projectReport = await this.service.create(input, session);
    return { projectReport };
  }

  @Query(() => ProjectReport, {
    description: 'Look up a project report by ID',
  })
  async projectReport(
    @AnonSession() session: Session,
    @IdArg() id: string
  ): Promise<ProjectReport> {
    return await this.service.readOne(id, session);
  }

  @Query(() => ProjectReportListOutput, {
    description: 'Look up project reports',
  })
  async projectReports(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => ProjectReportListInput,
      defaultValue: ProjectReportListInput.defaultVal,
    })
    input: ProjectReportListInput
  ): Promise<ProjectReportListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => UpdateProjectReportOutput, {
    description: 'Update a project member',
  })
  async updateProjectReport(
    @LoggedInSession() session: Session,
    @Args('input') { projectReport: input }: UpdateProjectReportInput
  ): Promise<UpdateProjectReportOutput> {
    const projectReport = await this.service.update(input, session);
    return { projectReport };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a project report',
  })
  async deleteProjectReport(
    @LoggedInSession() session: Session,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}

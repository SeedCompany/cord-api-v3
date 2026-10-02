import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  type ID,
  IdArg,
  mapSecuredValue,
  MutationPlaceholderOutput,
} from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { UserLoader } from '../../user';
import { SecuredUser } from '../../user/dto';
import {
  CreateGtlReportPracticum,
  GTLReport,
  GtlReportPracticum,
  GtlReportPracticumCreated,
  GtlReportPracticumUpdated,
  UpdateGtlReportPracticum,
} from '../dto';
import { GtlReportPracticumService } from '../practicums/gtl-report-practicum.service';

/** The Practicum section of a GTL report. */
@Resolver(GTLReport)
export class GtlReportPracticumsResolver {
  constructor(private readonly practicumService: GtlReportPracticumService) {}

  @ResolveField(() => [GtlReportPracticum], {
    description: 'Practicum and workshop involvement reported this quarter',
  })
  async practicums(@Parent() report: GTLReport): Promise<GtlReportPracticum[]> {
    return await this.practicumService.listForReport(report.id);
  }

  @Mutation(() => GtlReportPracticumCreated)
  async createGtlReportPracticum(
    @Args('input') input: CreateGtlReportPracticum,
  ): Promise<GtlReportPracticumCreated> {
    return { gtlReportPracticum: await this.practicumService.create(input) };
  }

  @Mutation(() => GtlReportPracticumUpdated)
  async updateGtlReportPracticum(
    @Args('input') input: UpdateGtlReportPracticum,
  ): Promise<GtlReportPracticumUpdated> {
    return { gtlReportPracticum: await this.practicumService.update(input) };
  }

  @Mutation(() => MutationPlaceholderOutput)
  async deleteGtlReportPracticum(
    @IdArg() id: ID,
  ): Promise<MutationPlaceholderOutput> {
    await this.practicumService.delete(id);
    return {};
  }
}

@Resolver(GtlReportPracticum)
export class GtlReportPracticumResolver {
  @ResolveField(() => SecuredUser, {
    description: 'The mentor involved in this practicum, if any',
  })
  async mentor(
    @Parent() practicum: GtlReportPracticum,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser> {
    return await mapSecuredValue(practicum.mentor, ({ id }) => users.load(id));
  }
}

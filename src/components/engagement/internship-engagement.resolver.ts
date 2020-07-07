import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { FileService, SecuredFile } from '../file';
import { InternshipEngagement } from './dto';

@Resolver(InternshipEngagement.classType)
export class InternshipEngagementResolver {
  constructor(private readonly files: FileService) {}

  @ResolveField(() => SecuredFile, {
    description: 'The growthPlan',
  })
  async growthPlan(
    @Parent() engagement: InternshipEngagement,
    @Session() session: ISession
  ): Promise<SecuredFile> {
    return this.files.resolveDefinedFile(engagement.growthPlan, session);
  }
}

import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { FileService, SecuredFile } from '../file';
import { LocationService } from '../location';
import { SecuredLocation } from '../location/dto';
import { SecuredUser, UserService } from '../user';
import {
  InternshipEngagement,
  InternshipPositionToProgram,
  SecuredInternshipProgram,
} from './dto';

@Resolver(InternshipEngagement)
export class InternshipEngagementResolver {
  constructor(
    private readonly files: FileService,
    private readonly users: UserService,
    private readonly locations: LocationService
  ) {}

  @ResolveField(() => SecuredFile)
  async growthPlan(
    @Parent() engagement: InternshipEngagement,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(engagement.growthPlan, session);
  }

  @ResolveField(() => SecuredUser)
  async intern(
    @Parent() engagement: InternshipEngagement,
    @AnonSession() session: Session
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = engagement.intern;
    const value = id ? await this.users.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredUser)
  async mentor(
    @Parent() engagement: InternshipEngagement,
    @AnonSession() session: Session
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = engagement.mentor;
    const value = id ? await this.users.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredLocation)
  async countryOfOrigin(
    @Parent() engagement: InternshipEngagement,
    @AnonSession() session: Session
  ): Promise<SecuredLocation> {
    const { value: id, ...rest } = engagement.countryOfOrigin;
    const value = id ? await this.locations.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredInternshipProgram, {
    description:
      'The InternshipProgram based on the currently selected `position`',
  })
  async program(
    @Parent() engagement: InternshipEngagement
  ): Promise<SecuredInternshipProgram> {
    const { canRead, value: position } = engagement.position;
    return {
      value: canRead && position ? InternshipPositionToProgram[position] : null,
      canRead,
      canEdit: false,
    };
  }
}

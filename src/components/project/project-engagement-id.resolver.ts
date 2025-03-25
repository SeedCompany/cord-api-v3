import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  AbstractClassType,
  AnonSession,
  ID,
  IdArg,
  NotFoundException,
  Session,
} from '~/common';
import { Loader, LoaderOf } from '~/core';
import { Privileges } from '../authorization';
import { EngagementLoader } from '../engagement';
import {
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
} from '../engagement/dto';
import {
  InternshipProject,
  IProject,
  MomentumTranslationProject,
  MultiplicationTranslationProject,
  Project,
  TranslationProject,
} from './dto';

function makeResolver(
  projectClass: AbstractClassType<any>,
  engagementClass: AbstractClassType<any>,
) {
  @Resolver(projectClass)
  class ProjectEngagementIdConnectionResolver {
    constructor(private readonly privileges: Privileges) {}

    @ResolveField(() => engagementClass)
    async engagement(
      @AnonSession() session: Session,
      @Parent() project: Project,
      @IdArg() engagementId: ID,
      @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    ): Promise<IEngagement> {
      // Copied from ProjectService.listEngagements
      this.privileges
        .for(session, IProject, {
          ...project,
          project,
        } as any)
        .verifyCan('read', 'engagement');

      const engagement = await engagements.load({
        id: engagementId,
        view: { active: true },
      });
      if (engagement.project.id !== project.id) {
        throw new NotFoundException('Engagement could not be found');
      }
      return engagement;
    }
  }

  return ProjectEngagementIdConnectionResolver;
}

class MultiplicationTranslationProjectEngagementIdResolver extends makeResolver(
  MultiplicationTranslationProject,
  LanguageEngagement,
) {}

class MomentumTranslationProjectEngagementIdResolver extends makeResolver(
  MomentumTranslationProject,
  LanguageEngagement,
) {}

class InternshipProjectEngagementIdResolver extends makeResolver(
  InternshipProject,
  InternshipEngagement,
) {}

class TranslationProjectEngagementIdResolver extends makeResolver(
  TranslationProject,
  LanguageEngagement,
) {}

class ProjectEngagementIdResolver extends makeResolver(IProject, IEngagement) {}

// Order matters!
export const ProjectEngagementIdResolvers = [
  InternshipProjectEngagementIdResolver,
  MomentumTranslationProjectEngagementIdResolver,
  MultiplicationTranslationProjectEngagementIdResolver,
  TranslationProjectEngagementIdResolver,
  ProjectEngagementIdResolver,
];

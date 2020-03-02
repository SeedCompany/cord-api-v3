import { Resolver } from '@nestjs/graphql';
import { TranslationProject } from './dto';
import { ProjectService } from './project.service';

@Resolver(TranslationProject.classType)
export class TranslationProjectResolver {
  constructor(private readonly projectService: ProjectService) {}
}

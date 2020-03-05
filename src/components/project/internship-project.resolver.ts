import { Resolver } from '@nestjs/graphql';
import { InternshipProject } from './dto';
import { ProjectService } from './project.service';

@Resolver(InternshipProject.classType)
export class InternshipProjectResolver {
  constructor(private readonly projectService: ProjectService) {}
}

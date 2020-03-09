import { Resolver } from '@nestjs/graphql';
import { InternshipProject } from './dto';

@Resolver(InternshipProject.classType)
export class InternshipProjectResolver {}

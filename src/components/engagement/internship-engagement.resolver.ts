import { Resolver } from '@nestjs/graphql';
import { InternshipEngagement } from './dto';

@Resolver(InternshipEngagement.classType)
export class InternshipEngagementResolver {}

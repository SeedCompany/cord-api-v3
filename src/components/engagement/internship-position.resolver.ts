import { Field, ObjectType, ResolveField, Resolver } from '@nestjs/graphql';
import { values } from 'lodash';
import {
  InternPosition,
  InternshipDomain,
  InternshipPositionToDomain,
  InternshipPositionToProgram,
  InternshipProgram,
  SecuredInternPosition,
} from './dto';

@ObjectType()
class InternshipPositionOptions {
  @Field(() => InternshipProgram)
  program: InternshipProgram;

  @Field(() => InternshipDomain, {
    nullable: true,
  })
  domain: InternshipDomain | null;

  @Field(() => InternPosition)
  position: InternPosition;
}

@Resolver(SecuredInternPosition)
export class InternshipPositionResolver {
  @ResolveField(() => [InternshipPositionOptions], {
    description:
      'The available position options for the internship engagement.',
  })
  options(): InternshipPositionOptions[] {
    return values(InternPosition).map((position) => ({
      position,
      domain: InternshipPositionToDomain[position],
      program: InternshipPositionToProgram[position],
    }));
  }
}

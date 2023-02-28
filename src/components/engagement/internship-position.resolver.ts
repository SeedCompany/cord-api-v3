import {
  Field,
  ObjectType,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { difference, values } from 'lodash';
import {
  historic,
  InternshipDomain,
  InternshipPosition,
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

  @Field(() => InternshipPosition)
  position: InternshipPosition;
}

@Resolver(SecuredInternPosition)
export class InternshipPositionResolver {
  @ResolveField(() => [InternshipPositionOptions], {
    description:
      'The available position options for the internship engagement.',
  })
  options(): InternshipPositionOptions[] {
    return difference(values(InternshipPosition), historic).map((position) => ({
      position,
      domain: InternshipPositionToDomain[position],
      program: InternshipPositionToProgram[position],
    }));
  }

  @ResolveField(() => InternshipDomain, {
    nullable: true,
    description: 'The InternshipDomain based on the currently selected `value`',
  })
  domain(
    @Parent() { value: position }: SecuredInternPosition,
  ): InternshipDomain | null {
    return position ? InternshipPositionToDomain[position] : null;
  }

  @ResolveField(() => InternshipProgram, {
    nullable: true,
    description:
      'The InternshipProgram based on the currently selected `value`',
  })
  program(
    @Parent() { value: position }: SecuredInternPosition,
  ): InternshipProgram | null {
    return position ? InternshipPositionToProgram[position] : null;
  }
}
